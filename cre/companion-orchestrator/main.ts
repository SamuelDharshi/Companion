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
  hexToBase64,
  json,
  ok,
  TxStatus,
  type Runtime,
} from "@chainlink/cre-sdk"
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiParameters,
  toBytes,
  zeroAddress,
  type Address,
} from "viem"
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
 * Why actions go through HTTP: ThunaiVault has no `onReport`, and adding a second authority over a vault that holds
 * family money is the wrong trade. So the vault is only read, and actions go through the agent, which holds the
 * authority-free keeper key.
 *
 * What CRE does write: when `auditLogAddress` is configured, each completed action is sent as a signed report to
 * CompanionAuditLog, a separate contract that holds no money and has no power over the vault.
 */

const configSchema = z.object({
  schedule: z.string(),
  chainSelectorName: z.string(),
  vaultAddress: z.string(),
  agentUrl: z.string(),
  maxFamilies: z.number().int().positive(),
  maxHolds: z.number().int().positive(),
  repageAfterSeconds: z.number().int().positive(),
  auditLogAddress: z.string().optional(),
  auditGasLimit: z.string().optional(),
  maxAuditWrites: z.number().int().nonnegative().optional(),
})
type Config = z.infer<typeof configSchema>

const HOLD_OPEN = 1
// ReceiverContractExecutionStatus.SUCCESS in the EVM capability; the SDK root does not export this enum.
const RECEIVER_SUCCESS = 0

// Must match CompanionAuditLog.Action.
const AUDIT = { ALLOWANCE_SENT: 0, HOLD_REPAGED: 1, HOLD_EXPIRED_REFUNDED: 2 } as const
type AuditAction = (typeof AUDIT)[keyof typeof AUDIT]

const vaultAbi = parseAbi([
  "function familyCount() view returns (uint256)",
  "function holdCount() view returns (uint256)",
  "function allowanceDue(uint256 familyId) view returns (bool)",
  "function hold(uint256 holdId) view returns ((uint256 familyId, address to, uint128 amount, uint8 reason, uint8 status, uint64 openedAt, uint64 releaseAt, bytes32 memoHash))",
])

// CRE allows only 15 chain reads per workflow run, and this loop would otherwise make one per family and per hold. Multicall3
// (the same contract at the same address on every chain, including Monad testnet) lets one read carry many calls, so a whole
// run costs two chain reads however many families and holds there are.
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address
const multicallAbi = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
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

  /** One chain read that carries many vault calls. Results come back in the same order, decoded. */
  const readMany = (calls: { functionName: "familyCount" | "holdCount" | "allowanceDue" | "hold"; args?: readonly unknown[] }[]): any[] => {
    const encoded = calls.map((c) => ({
      target: vault,
      allowFailure: true,
      callData: encodeFunctionData({ abi: vaultAbi, functionName: c.functionName, args: c.args ?? [] } as never),
    }))
    const reply = evm
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: MULTICALL3,
          data: encodeFunctionData({ abi: multicallAbi, functionName: "aggregate3", args: [encoded] }),
        }),
        blockNumber: LATEST_BLOCK_NUMBER,
      })
      .result()
    const results = decodeFunctionResult({ abi: multicallAbi, functionName: "aggregate3", data: bytesToHex(reply.data) }) as readonly {
      success: boolean
      returnData: `0x${string}`
    }[]
    return results.map((r, i) =>
      r.success
        ? decodeFunctionResult({ abi: vaultAbi, functionName: calls[i].functionName, data: r.returnData } as never)
        : undefined,
    )
  }

  const nowSeconds = Math.floor(runtime.now().getTime() / 1000)
  const [familyCountRaw, holdCountRaw] = readMany([{ functionName: "familyCount" }, { functionName: "holdCount" }])
  const families = Number(familyCountRaw as bigint)
  const holds = Number(holdCountRaw as bigint)
  runtime.log(`Read Monad testnet: ${families} families, ${holds} holds`)

  // Second and last chain read: every family's allowance flag and every recent hold, in one call.
  const familyIds = Array.from({ length: Math.min(families, config.maxFamilies) }, (_, k) => k + 1)
  const oldest = Math.max(1, holds - config.maxHolds + 1)
  const holdIds = Array.from({ length: holds >= oldest ? holds - oldest + 1 : 0 }, (_, k) => holds - k)
  const batch = readMany([
    ...familyIds.map((id) => ({ functionName: "allowanceDue" as const, args: [BigInt(id)] })),
    ...holdIds.map((id) => ({ functionName: "hold" as const, args: [BigInt(id)] })),
  ])
  const due = batch.slice(0, familyIds.length) as (boolean | undefined)[]
  const holdRows = batch.slice(familyIds.length) as ({ familyId: bigint; status: number; openedAt: bigint; releaseAt: bigint } | undefined)[]
  runtime.log(`Checked ${familyIds.length} allowances and ${holdIds.length} recent holds in one read`)

  const summary = { families, holds, allowancesSent: 0, holdsExpired: 0, parentsReminded: 0, skipped: 0, failed: 0, audited: 0, auditFailed: 0 }

  /** Records a completed action. A failed audit write is counted and logged; it never undoes or blocks the action. */
  const audit = (action: AuditAction, familyId: bigint, holdId: bigint, detail: unknown) => {
    if (!config.auditLogAddress || summary.audited + summary.auditFailed >= (config.maxAuditWrites ?? 3)) return
    const agentResultHash = keccak256(toBytes(JSON.stringify(detail ?? null)))
    const payload = encodeAbiParameters(parseAbiParameters("uint8, uint256, uint256, bytes32, uint64"), [
      action,
      familyId,
      holdId,
      agentResultHash,
      BigInt(nowSeconds),
    ])
    const report = runtime
      .report({ encodedPayload: hexToBase64(payload), encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256" })
      .result()
    const written = evm
      .writeReport(runtime, {
        receiver: config.auditLogAddress,
        report,
        gasConfig: { gasLimit: config.auditGasLimit ?? "500000" },
      })
      .result()
    const txHash = bytesToHex(written.txHash ?? new Uint8Array(32))
    // The transaction can succeed while the receiver reverts, so both statuses must pass.
    const delivered = written.txStatus === TxStatus.SUCCESS && written.receiverContractExecutionStatus === RECEIVER_SUCCESS
    if (delivered) summary.audited++
    else summary.auditFailed++
    runtime.log(`Audit write ${delivered ? "ok" : "FAILED"}: action=${action} tx=${txHash}`)
  }

  // 1. Allowances that are due.
  familyIds.forEach((familyId, k) => {
    if (due[k] !== true) return
    const reply = callAgent(runtime, token, "runAllowance", BigInt(familyId))
    if (succeeded(reply) && !reply.detail?.skipped) {
      summary.allowancesSent++
      runtime.log(`Allowance due for family ${familyId}: sent`)
      audit(AUDIT.ALLOWANCE_SENT, BigInt(familyId), 0n, reply.detail)
    } else if (succeeded(reply)) summary.skipped++
    else summary.failed++
  })

  // 2. Holds nobody has answered, newest first.
  holdIds.forEach((holdId, k) => {
    const h = holdRows[k]
    if (!h || Number(h.status) !== HOLD_OPEN) return

    if (nowSeconds >= Number(h.releaseAt)) {
      const reply = callAgent(runtime, token, "expireHold", BigInt(holdId))
      if (succeeded(reply) && !reply.detail?.skipped) {
        summary.holdsExpired++
        runtime.log(`Hold ${holdId} unanswered past its time: money returned to the student`)
        audit(AUDIT.HOLD_EXPIRED_REFUNDED, BigInt(h.familyId), BigInt(holdId), reply.detail)
      } else if (succeeded(reply)) summary.skipped++
      else summary.failed++
      return
    }

    // Remind the parent once, in the minute after the hold has been open for repageAfterSeconds.
    const age = nowSeconds - Number(h.openedAt)
    if (age >= config.repageAfterSeconds && age < config.repageAfterSeconds + 60) {
      const reply = callAgent(runtime, token, "repage", BigInt(holdId))
      if (succeeded(reply) && !reply.detail?.skipped) {
        summary.parentsReminded++
        audit(AUDIT.HOLD_REPAGED, BigInt(h.familyId), BigInt(holdId), reply.detail)
        runtime.log(
          `Hold ${holdId} still waiting after ${age}s: parent reminded (classified as script ${reply.detail?.classification?.scriptId ?? "?"})`,
        )
      } else if (succeeded(reply)) summary.skipped++
      else summary.failed++
    }
  })

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
