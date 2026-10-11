import {
  CronCapability,
  EVMClient,
  HTTPClient,
  Runner,
  LATEST_BLOCK_NUMBER,
  bytesToHex,
  consensusIdenticalAggregation,
  encodeCallMsg,
  getNetwork,
  handler,
  json,
  ok,
  type Runtime,
} from "@chainlink/cre-sdk"
import { decodeFunctionResult, encodeFunctionData, parseAbi, zeroAddress, type Address } from "viem"
import { z } from "zod"

/**
 * Companion's orchestrator, as a Chainlink CRE workflow.
 *
 * Companion has two jobs that must happen with nobody pressing a button:
 *
 *   1. send each family's weekly allowance when its signed envelope is due, and
 *   2. when a held payment is unanswered, remind the parent, and give the money back to the student when time is up.
 *
 * This workflow is the schedule and the eyes. Every minute it:
 *
 *   - READS Monad testnet (chain 10143) through CRE's EVM capability: how many families and holds there are, which
 *     families have an allowance due, and the state of each recent hold. Every node in the DON reads the chain, so one
 *     bad RPC cannot make us act on a wrong picture.
 *   - DECIDES what is due, using only the contract's own numbers (due flag, status, release time).
 *   - CALLS Companion's agent over HTTPS (/cre/apply) for each thing that is due. The agent re-checks the chain before
 *     acting, so a stale or replayed request does nothing.
 *
 * What it cannot do, by design: pay anybody. runAllowance runs the envelope the parent already signed with her own
 * Face ID. expireHold only ever returns money to the student. repage only sends a notification. A guardian's passkey is
 * the only thing that can release a held payment, and no workflow, ours or anyone's, holds it.
 *
 * Why HTTP and not an onchain write: CRE writes onchain by sending a signed report through a Chainlink forwarder to a
 * contract that implements `onReport`. ThunaiVault does not, and changing a vault that holds family money, days before
 * a deadline, to add a second authority over it is the wrong trade. So reads are onchain and actions go through the
 * agent, which already holds the (authority-free) keeper key.
 */

const configSchema = z.object({
  schedule: z.string(),
  chainSelectorName: z.string(),
  vaultAddress: z.string(),
  agentUrl: z.string(),
  maxFamilies: z.number().int().positive(),
  maxHolds: z.number().int().positive(),
  repageAfterSeconds: z.number().int().positive(),
})
type Config = z.infer<typeof configSchema>

const HOLD_OPEN = 1

const vaultAbi = parseAbi([
  "function familyCount() view returns (uint256)",
  "function holdCount() view returns (uint256)",
  "function allowanceDue(uint256 familyId) view returns (bool)",
  "function hold(uint256 holdId) view returns ((uint256 familyId, address to, uint128 amount, uint8 reason, uint8 status, uint64 openedAt, uint64 releaseAt, bytes32 memoHash))",
])

type Applied = { status: number; body: string }

/** One authenticated call to the agent. Runs on the DON with consensus; `cacheSettings` makes exactly one node send it. */
const callAgent = (
  runtime: Runtime<Config>,
  token: string,
  action: "runAllowance" | "expireHold" | "repage",
  id: bigint,
): { status: number; detail: any } => {
  const payload = JSON.stringify({ action, id: id.toString() })
  const result = new HTTPClient()
    .sendRequest(
      runtime,
      (sendRequester, url: string, authToken: string, bodyJson: string): Applied => {
        const response = sendRequester
          .sendRequest({
            url,
            method: "POST",
            headers: { "Content-Type": "application/json", "x-cre-token": authToken },
            body: Buffer.from(new TextEncoder().encode(bodyJson)).toString("base64"),
            cacheSettings: { store: true, maxAge: "30s" },
          })
          .result()
        if (!ok(response)) return { status: response.statusCode, body: "" }
        // Keep only the fields every node will see identically.
        const parsed = json(response) as Record<string, unknown>
        const { latencyMs: _ignored, ...stable } = parsed
        return { status: response.statusCode, body: JSON.stringify(stable) }
      },
      consensusIdenticalAggregation<Applied>(),
    )(`${runtime.config.agentUrl.replace(/\/$/, "")}/cre/apply`, token, payload)
    .result()

  return { status: result.status, detail: result.body ? JSON.parse(result.body) : null }
}

const succeeded = (reply: { status: number }) => reply.status >= 200 && reply.status < 300

const onCron = (runtime: Runtime<Config>): string => {
  const config = runtime.config
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName })
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`)
  const evm = new EVMClient(network.chainSelector.selector)
  const vault = config.vaultAddress as Address
  const token = runtime.getSecret({ id: "CRE_TOKEN" }).result().value

  const read = (functionName: "familyCount" | "holdCount" | "allowanceDue" | "hold", args: readonly unknown[] = []): any => {
    const reply = evm
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: vault,
          data: encodeFunctionData({ abi: vaultAbi, functionName, args } as never),
        }),
        blockNumber: LATEST_BLOCK_NUMBER,
      })
      .result()
    return decodeFunctionResult({ abi: vaultAbi, functionName, data: bytesToHex(reply.data) } as never)
  }

  const nowSeconds = Math.floor(runtime.now().getTime() / 1000)
  const families = Number(read("familyCount") as bigint)
  const holds = Number(read("holdCount") as bigint)
  runtime.log(`Read Monad testnet: ${families} families, ${holds} holds`)

  const summary = { families, holds, allowancesSent: 0, holdsExpired: 0, parentsReminded: 0, skipped: 0, failed: 0 }

  // 1. Allowances that are due.
  for (let familyId = 1; familyId <= Math.min(families, config.maxFamilies); familyId++) {
    if (!(read("allowanceDue", [BigInt(familyId)]) as boolean)) continue
    const reply = callAgent(runtime, token, "runAllowance", BigInt(familyId))
    if (succeeded(reply) && !reply.detail?.skipped) {
      summary.allowancesSent++
      runtime.log(`Allowance due for family ${familyId}: sent`)
    } else if (succeeded(reply)) summary.skipped++
    else summary.failed++
  }

  // 2. Holds nobody has answered, newest first.
  const oldest = Math.max(1, holds - config.maxHolds + 1)
  for (let holdId = holds; holdId >= oldest; holdId--) {
    const h = read("hold", [BigInt(holdId)]) as { status: number; openedAt: bigint; releaseAt: bigint }
    if (Number(h.status) !== HOLD_OPEN) continue

    if (nowSeconds >= Number(h.releaseAt)) {
      const reply = callAgent(runtime, token, "expireHold", BigInt(holdId))
      if (succeeded(reply) && !reply.detail?.skipped) {
        summary.holdsExpired++
        runtime.log(`Hold ${holdId} unanswered past its time: money returned to the student`)
      } else if (succeeded(reply)) summary.skipped++
      else summary.failed++
      continue
    }

    // Remind the parent once, in the minute after the hold has been open for repageAfterSeconds.
    const age = nowSeconds - Number(h.openedAt)
    if (age >= config.repageAfterSeconds && age < config.repageAfterSeconds + 60) {
      const reply = callAgent(runtime, token, "repage", BigInt(holdId))
      if (succeeded(reply) && !reply.detail?.skipped) {
        summary.parentsReminded++
        runtime.log(
          `Hold ${holdId} still waiting after ${age}s: parent reminded (classified as script ${reply.detail?.classification?.scriptId ?? "?"})`,
        )
      } else if (succeeded(reply)) summary.skipped++
      else summary.failed++
    }
  }

  runtime.log(`Done: ${JSON.stringify(summary)}`)
  return JSON.stringify(summary)
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCron)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
