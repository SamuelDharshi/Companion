#!/usr/bin/env node
/**
 * Local end-to-end run: the whole rescue, on a real chain, through the real relayer.
 *
 * This is the demo rehearsal in script form. It spins up Anvil, deploys the contracts,
 * etches a P256 verifier where Monad has its precompile, starts the relayer, and then
 * plays out the scene from the PRD with genuine WebAuthn assertions:
 *
 *   1. Arjun and Kavya onboard; Kavya signs the envelope with Face ID.
 *   2. Money from home arrives and settles.
 *   3. Rent pays itself, because the landlord is on the signed schedule.
 *   4. Arjun sends $2,000 to a new payee: HELD, instantly, money still in the vault.
 *   5. Kavya taps "Stop it" with Face ID: the $2,000 comes back, the payee gets nothing.
 *   6. A second hold is left unanswered and expires: the money still comes back.
 *
 * Run: pnpm e2e
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  parseUnits,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { createPasskey, signAssertion } from "./lib/passkey.mjs";
import { HOLD_OPENED_TOPIC, SOS_RAISED_TOPIC } from "../agent/src/alchemy.ts";
import {
  envelopeChallenge,
  livenessChallenge,
  reportChallenge,
  resolveHoldChallenge,
} from "./lib/challenges.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Two ways to run the same scene:
//   pnpm e2e           a private local chain: Anvil, a fresh deploy, our own relayer and agent.
//   pnpm e2e:testnet   the LIVE Monad testnet, through the running relayer and agent. It uses fresh
//                      random keys (nothing reusable), waits real seconds instead of time travel, and
//                      records the measured timings to docs/e2e-testnet.json.
const TESTNET = process.env.E2E_TARGET === "testnet";
// The local run deploys its own fresh contracts, so it must never pick up a named deployment (THUNAI_DEPLOYMENT=agora) from
// the root .env: the services would look for 31337.agora.json and lose the token addresses. An empty value wins over .env.
if (!TESTNET) process.env.THUNAI_DEPLOYMENT = "";

function readDotEnv() {
  try {
    return Object.fromEntries(
      readFileSync(join(root, ".env"), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, "").trim()];
        }),
    );
  } catch {
    return {};
  }
}
const dotenv = TESTNET ? { ...readDotEnv(), ...process.env } : {};

const RPC = TESTNET ? dotenv.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz" : "http://127.0.0.1:8545";
const RELAYER_URL = TESTNET ? process.env.E2E_RELAYER_URL || "http://127.0.0.1:8787" : "http://127.0.0.1:8799";
const AGENT_URL = TESTNET ? process.env.E2E_AGENT_URL || "http://127.0.0.1:8788" : "http://127.0.0.1:8798";
// Local runs use fixed tokens so they never depend on a developer's .env. A testnet run uses the real ones.
const E2E_ADMIN = TESTNET ? dotenv.DEV_ADMIN_TOKEN : "e2e-admin-token-0123456789abcdef";
const E2E_INTERNAL = TESTNET ? dotenv.INTERNAL_TOKEN : "e2e-internal-token-0123456789abcdef";
const E2E_CRE = TESTNET ? dotenv.CRE_TOKEN : "e2e-cre-token-0123456789abcdef0123";
const E2E_ALCHEMY = TESTNET ? dotenv.ALCHEMY_WEBHOOK_SIGNING_KEY : "e2e-alchemy-signing-key-0123456789";
if (TESTNET && (!E2E_ADMIN || !E2E_INTERNAL)) {
  console.error("A testnet run needs DEV_ADMIN_TOKEN and INTERNAL_TOKEN in .env (and the same ones in the running services).");
  process.exit(1);
}

const randomKey = () => generatePrivateKey();
// Anvil's public accounts locally. On testnet every key is random and thrown away when the run ends.
const DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ARJUN_ACCT_PK = TESTNET ? randomKey() : "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const AMMA_ACCT_PK = TESTNET ? randomKey() : "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const DURESS_PK = TESTNET ? randomKey() : "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

const LANDLORD = TESTNET ? privateKeyToAccount(randomKey()).address : "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const SCAMMER = TESTNET ? privateKeyToAccount(randomKey()).address : "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";

// Every relayer call that reports a latency is recorded, so the numbers we quote are measured.
const timings = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USD = (n) => parseUnits(String(n), 6);

const children = [];
let failed = false;

function log(step, message) {
  console.log(`\n\x1b[36m${step}\x1b[0m ${message}`);
}
function ok(message) {
  console.log(`  \x1b[32mok\x1b[0m   ${message}`);
}
function assert(condition, message) {
  if (condition) return ok(message);
  failed = true;
  console.log(`  \x1b[31mFAIL\x1b[0m ${message}`);
}

function spawnProc(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { cwd: root, shell: true, ...opts });
  children.push(child);
  const prefix = `\x1b[90m[${name}]\x1b[0m `;
  child.stdout?.on("data", (d) => {
    if (process.env.E2E_VERBOSE) process.stdout.write(prefix + d.toString());
  });
  child.stderr?.on("data", (d) => {
    if (process.env.E2E_VERBOSE) process.stderr.write(prefix + d.toString());
  });
  return child;
}

/**
 * Refuses to start when a port is already held.
 *
 * Without this, a leftover process from an earlier run answers the health check and the
 * whole suite silently tests stale code — which is exactly how a "passing" run can hide
 * a broken build.
 */
async function requireFreePort(port, label) {
  const { createServer } = await import("node:net");
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `port ${port} (${label}) is already in use — a previous run is still alive. ` +
            `Kill it and retry.`,
        ),
      ),
    );
    server.once("listening", () => server.close(resolve));
    server.listen(port, "127.0.0.1");
  });
}

async function waitFor(label, probe, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await probe()) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function api(path, init) {
  const response = await fetch(`${RELAYER_URL}${path}`, {
    ...init,
    // Fastify rejects a JSON content-type with an empty body, and several routes take
    // no arguments at all.
    body: init?.method === "POST" && init?.body === undefined ? "{}" : init?.body,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (body && typeof body.latencyMs === "number") timings.push({ path: path.split("?")[0], latencyMs: body.latencyMs });
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${body.error ?? text}`);
  return body;
}

function cleanup() {
  for (const child of children.reverse()) {
    try {
      // Kill the whole tree: `shell: true` means the child is a shell wrapper.
      if (process.platform === "win32") {
        // `shell: true` means the child is a shell wrapper, so the real server is a
        // grandchild. /t kills the tree, and running it synchronously guarantees the
        // ports are released before this process exits.
        spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], { shell: true, stdio: "ignore" });
      }
      else child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

// ---------------------------------------------------------------------------

try {
  let publicClient;
  let deployment;
  let config;
  if (TESTNET) {
    log("1/9", "Connecting to the live Monad testnet through the running relayer and agent");
    publicClient = createPublicClient({ transport: http(RPC) });
    deployment = JSON.parse(
      readFileSync(
        join(root, "contracts", "deployments", dotenv.THUNAI_DEPLOYMENT ? `10143.${dotenv.THUNAI_DEPLOYMENT}.json` : "10143.json"),
        "utf8",
      ),
    );
    await waitFor("relayer", async () => (await fetch(`${RELAYER_URL}/health`)).ok);
    await waitFor("agent", async () => (await fetch(`${AGENT_URL}/health`)).ok);
    config = await api("/config");
    assert(config.chainId === 10143, `the relayer is on Monad testnet (chain ${config.chainId})`);
    assert(
      config.thunaiVault.toLowerCase() === deployment.thunaiVault.toLowerCase(),
      `the relayer points at the deployed vault ${deployment.thunaiVault}`,
    );
    const agentHealth = await (await fetch(`${AGENT_URL}/health`)).json();
    ok(`agent up, classifier: ${agentHealth.classifier}`);
  } else {
    await requireFreePort(8545, "anvil");
    await requireFreePort(8799, "relayer");
    await requireFreePort(8798, "agent");

    log("1/9", "Starting Anvil");
    spawnProc("anvil", "anvil", ["--silent", "--port", "8545"]);
    publicClient = createPublicClient({ chain: foundry, transport: http(RPC) });
    await waitFor("anvil", async () => (await publicClient.getBlockNumber()) >= 0n);
    ok("chain up");

    log("2/9", "Deploying ThunaiVault and ScamSignals");
    await new Promise((resolve, reject) => {
      const proc = spawnProc("forge", "forge", [
        "script",
        "script/Deploy.s.sol:Deploy",
        "--rpc-url",
        RPC,
        "--broadcast",
        "--skip-simulation",
      ], {
        cwd: join(root, "contracts"),
        env: {
          ...process.env,
          FOUNDRY_DISABLE_NIGHTLY_WARNING: "1",
          DEPLOYER_PRIVATE_KEY: DEPLOYER_PK,
          SEED_AUSD_FLOAT: String(USD(1_000_000)),
        },
      });
      proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`forge script exited ${code}`))));
    });
    deployment = JSON.parse(readFileSync(join(root, "contracts", "deployments", "31337.json"), "utf8"));
    ok(`vault ${deployment.thunaiVault}`);

    log("3/9", "Etching a P256 verifier where Monad has its 0x0100 precompile");
    // Monad exposes EIP-7951 natively; Anvil does not, so the same audited verifier Solady
    // vendors is placed at both the precompile and the fallback address.
    const verifierSol = readFileSync(join(root, "contracts", "test", "utils", "P256Enabled.sol"), "utf8");
    const bytecode = `0x${verifierSol.match(/hex"([0-9a-fA-F]+)"/)[1]}`;
    for (const addr of [
      "0x0000000000000000000000000000000000000100",
      "0x000000000000D01eA45F9eFD5c54f037Fa57Ea1a",
    ]) {
      await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "anvil_setCode", params: [addr, bytecode] }),
      });
    }
    ok("secp256r1 verification available");

    log("4/9", "Starting the relayer");
    spawnProc("relayer", "pnpm", ["exec", "tsx", "src/index.ts"], {
      cwd: join(root, "relayer"),
      env: {
        ...process.env,
        PORT: "8799",
        MONAD_RPC_URL: RPC,
        RELAYER_PRIVATE_KEY: DEPLOYER_PK,
        THUNAI_VAULT_ADDRESS: deployment.thunaiVault,
        SCAM_SIGNALS_ADDRESS: deployment.scamSignals,
        DATA_DIR: join(root, ".data-e2e"),
        AGENT_URL: AGENT_URL,
        DEV_ADMIN_TOKEN: E2E_ADMIN,
        INTERNAL_TOKEN: E2E_INTERNAL,
        TESTNET_PARTNER_STANDIN: "true",
        LOG_LEVEL: "warn",
      },
    });
    await waitFor("relayer", async () => (await fetch(`${RELAYER_URL}/health`)).ok);
    config = await api("/config");
    ok(`relayer up, chainId ${config.chainId}`);

    log("4b/9", "Starting the agent (classifier + keeper)");
    spawnProc("agent", "pnpm", ["exec", "tsx", "src/index.ts"], {
      cwd: join(root, "agent"),
      env: {
        ...process.env,
        AGENT_PORT: "8798",
        MONAD_RPC_URL: RPC,
        AGENT_PRIVATE_KEY: DEPLOYER_PK,
        THUNAI_VAULT_ADDRESS: deployment.thunaiVault,
        SCAM_SIGNALS_ADDRESS: deployment.scamSignals,
        RELAYER_URL,
        // Force the deterministic classifier so the run costs nothing and never flakes on
        // a network call. The model path is exercised separately.
        ANTHROPIC_API_KEY: "",
        KEEPER_ENABLED: "false",
        DEV_ADMIN_TOKEN: E2E_ADMIN,
        INTERNAL_TOKEN: E2E_INTERNAL,
        CRE_TOKEN: E2E_CRE,
        ALCHEMY_WEBHOOK_SIGNING_KEY: E2E_ALCHEMY,
        ORCHESTRATOR: "cre",
        LOG_LEVEL: "warn",
      },
    });
    await waitFor("agent", async () => (await fetch(`${AGENT_URL}/health`)).ok);
    const agentHealth = await (await fetch(`${AGENT_URL}/health`)).json();
    ok(`agent up, classifier: ${agentHealth.classifier}`);

  }

  log("5/9", "Onboarding: one passkey each, then Kavya signs the envelope");
  const ammaPasskey = createPasskey(TESTNET ? randomKey() : "0xA11CE");
  const arjunPasskey = createPasskey(TESTNET ? randomKey() : "0xB0B");
  const arjunAcct = privateKeyToAccount(ARJUN_ACCT_PK);
  const ammaAcct = privateKeyToAccount(AMMA_ACCT_PK);
  const duressAcct = privateKeyToAccount(DURESS_PK);

  // Step one: Arjun creates a passkey. Nothing is written to the chain yet, by design.
  const invited = await api("/onboard/student", {
    method: "POST",
    body: JSON.stringify({
      studentPasskey: { x: `0x${arjunPasskey.x}`, y: `0x${arjunPasskey.y}` },
      studentAcct: arjunAcct.address,
      duressAddr: duressAcct.address,
      studentName: "Arjun",
    }),
  });
  assert(typeof invited.inviteCode === "string", "invite link created for Kavya");

  const beforeAccept = await api(`/invite/${invited.inviteCode}`);
  assert(beforeAccept.familyId === null, "no family onchain until Kavya accepts");

  // Step two: Kavya accepts, and only now does the family exist, with two real passkeys.
  const registered = await api("/onboard/guardian", {
    method: "POST",
    body: JSON.stringify({
      inviteCode: invited.inviteCode,
      guardianPasskey: { x: `0x${ammaPasskey.x}`, y: `0x${ammaPasskey.y}` },
      guardianAcct: ammaAcct.address,
      guardianName: "Kavya",
    }),
  });
  const familyId = BigInt(registered.familyId);
  assert(familyId > 0n, `family ${familyId} registered (${registered.latencyMs}ms)`);

  // The stateless restore: an address alone is enough to find the family again.
  const found = await api(`/family/by-account/${arjunAcct.address}`);
  assert(
    found.familyId === String(familyId) && found.role === "student",
    "a passkey address alone recovers the family, with no stored state",
  );

  // The landlord goes on the schedule, so rent can pay itself.
  const payees = await api("/payees", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), address: LANDLORD, name: "Landlord", scheduled: true }),
  });
  ok(`schedule root ${payees.payeesRoot.slice(0, 18)}…`);

  const now = Math.floor(Date.now() / 1000);
  const envelope = {
    weeklyAmount: USD(150),
    perWithdrawalCap: USD(1000),
    payeesRoot: payees.payeesRoot,
    cadence: 604800n,
    holdTimeout: TESTNET ? 25n : 1800n,
    expiry: BigInt(now + 365 * 86400),
    nextRunAt: BigInt(now),
  };
  // Ask the contract for the challenge, the same way the app does, and check our local
  // helper agrees. A mismatch here would mean approvals fail only on a real device.
  const envelopeJson = Object.fromEntries(
    Object.entries(envelope).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]),
  );
  const fromContract = await api("/family/envelope-challenge", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), envelope: envelopeJson }),
  });
  const envChallenge = envelopeChallenge(config.chainId, config.thunaiVault, familyId, envelope);
  assert(
    fromContract.challenge.toLowerCase() === envChallenge.toLowerCase(),
    "the contract and the app compute the same passkey challenge",
  );
  await api("/family/envelope", {
    method: "POST",
    body: JSON.stringify({
      familyId: String(familyId),
      envelope: envelopeJson,
      auth: signAssertion(ammaPasskey, envChallenge),
    }),
  });
  ok("envelope signed with Face ID and verified onchain");

  log("6/9", "Money from home arrives and settles");
  if (TESTNET) {
    // On testnet the relayer's float plays the licensed remittance partner, through the dev endpoint.
    const funded = await api("/fund", {
      method: "POST",
      headers: { "x-admin-token": E2E_ADMIN },
      body: JSON.stringify({ familyId: String(familyId), amount: String(USD(3000)), settle: true }),
    });
    ok(`$3,000 settled in ${funded.latencyMs}ms`);
  } else {
    const deployer = privateKeyToAccount(DEPLOYER_PK);
    const wallet = createWalletClient({ account: deployer, chain: foundry, transport: http(RPC) });
    const erc20Approve = [
      { name: "approve", type: "function", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
    ];
    await wallet.sendTransaction({
      to: deployment.ctk,
      data: encodeFunctionData({ abi: erc20Approve, functionName: "approve", args: [deployment.thunaiVault, USD(999_999)] }),
    });
    const fundAbi = [
      { name: "fundAndSettle", type: "function", inputs: [{ type: "uint256" }, { type: "uint128" }], outputs: [] },
    ];
    await wallet.sendTransaction({
      to: deployment.thunaiVault,
      data: encodeFunctionData({ abi: fundAbi, functionName: "fundAndSettle", args: [familyId, USD(3000)] }),
    });
  }
  let family = await api(`/family/${familyId}`);
  assert(family.balanceLabel === "$3,000", `allowance arrived: ${family.balanceLabel}`);

  log("7/9", "Rent pays itself, because the landlord is on the signed schedule");
  async function sendMoney(to, amountUsd, memo) {
    const digest = await api(
      `/withdraw/digest?familyId=${familyId}&to=${to}&amount=${USD(amountUsd)}&memo=${encodeURIComponent(memo)}`,
    );
    const signature = await arjunAcct.sign({ hash: digest.digest });
    return api("/withdraw", {
      method: "POST",
      body: JSON.stringify({
        familyId: String(familyId),
        to,
        amount: String(USD(amountUsd)),
        memo,
        nonce: digest.nonce,
        deadline: digest.deadline,
        signature,
        localHour: 23,
      }),
    });
  }
  const rent = await sendMoney(LANDLORD, 900, "rent");
  assert(rent.held === false, `rent paid straight through (${rent.latencyMs}ms, sync=${rent.sync})`);

  log("8/9", "The scam: $2,000 to a new payee is HELD, and Kavya stops it");
  const bond = await sendMoney(SCAMMER, 2000, "immigration bond");
  assert(bond.held === true, `held instantly, reason ${bond.reasonName} (${bond.latencyMs}ms)`);

  const holdId = BigInt(bond.holdId);
  let hold = await api(`/hold/${holdId}`);
  assert(hold.statusName === "OPEN", `hold ${holdId} open for ${hold.amountLabel}`);

  family = await api(`/family/${familyId}`);
  assert(family.balanceLabel === "$100", "the $2,000 left the spendable balance");

  // The relayer hands the hold to the agent fire-and-forget, so the family never waits
  // on the classifier. Give it a moment, then check what the guardian would be shown.
  await new Promise((r) => setTimeout(r, 1500));
  const brief = await (await fetch(`${AGENT_URL}/brief/${holdId}`)).json();
  assert(brief.classification?.scriptId === 1, `classified as the fake officer scam`);
  assert(
    typeof brief.alert?.body === "string" && brief.alert.body.includes("$2,000"),
    `alert reads: "${brief.alert?.body?.slice(0, 90)}…"`,
  );
  assert(brief.classification.explanation_ta?.length > 0, "Tamil explanation present");
  assert(typeof brief.whatsAppLink === "string", "WhatsApp backstop link built");

  const cancelChallenge = resolveHoldChallenge(config.chainId, config.thunaiVault, familyId, holdId, false);
  const resolved = await api("/hold/resolve", {
    method: "POST",
    body: JSON.stringify({
      holdId: String(holdId),
      release: false,
      auth: signAssertion(ammaPasskey, cancelChallenge),
    }),
  });
  ok(`Kavya stopped it with Face ID in ${resolved.latencyMs}ms`);

  hold = await api(`/hold/${holdId}`);
  assert(hold.statusName === "CANCELLED", "hold cancelled");
  family = await api(`/family/${familyId}`);
  assert(family.balanceLabel === "$2,100", `money is back: ${family.balanceLabel}`);

  const scammerBalance = await publicClient.readContract({
    address: deployment.ausd,
    abi: [{ name: "balanceOf", type: "function", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
    functionName: "balanceOf",
    args: [SCAMMER],
  });
  assert(scammerBalance === 0n, "the payee received nothing, at any point");

  log("9/9", "Fail-safe: an unanswered hold returns the money by itself");
  const second = await sendMoney(SCAMMER, 500, "another bond");
  assert(second.held === true, `second attempt held (${second.reasonName})`);

  if (TESTNET) {
    // No time travel on a real chain: wait out the 25-second timeout this run signed.
    ok("waiting 30 real seconds for the hold to time out");
    await sleep(30_000);
  } else {
    // Past the 30-minute timeout, anyone may expire it. The keeper does this automatically.
    await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "evm_increaseTime", params: [1801] }),
    });
    await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "evm_mine", params: [] }),
    });
  }
  // Let the KEEPER do it, which is what happens in production.
  let expired;
  for (let attempt = 0; attempt < 8; attempt++) {
    await fetch(`${AGENT_URL}/keeper/tick`, { method: "POST", headers: { "x-admin-token": E2E_ADMIN } });
    expired = await api(`/hold/${second.holdId}`);
    if (expired.statusName === "EXPIRED") break;
    await sleep(2000);
  }
  assert(expired.statusName === "EXPIRED", "hold expired");
  family = await api(`/family/${familyId}`);
  assert(family.balanceLabel === "$2,100", `money came back without anyone answering: ${family.balanceLabel}`);

  log("10/15", "Woah 2: a cloned voice calls Kavya, so she checks on Arjun");
  const check = await api("/check/request", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId) }),
  });
  assert(check.nonce !== "0", `check requested (${check.latencyMs}ms)`);

  // While the check goes unanswered, anything to a new payee is held for that reason.
  const duringCheck = await sendMoney(SCAMMER, 50, "quick favour");
  assert(
    duringCheck.reasonName === "CHECK_PENDING",
    `an unanswered check holds new payments (${duringCheck.reasonName})`,
  );

  const liveness = livenessChallenge(config.chainId, config.thunaiVault, familyId, check.nonce);
  const proved = await api("/check/prove", {
    method: "POST",
    body: JSON.stringify({
      familyId: String(familyId),
      nonce: check.nonce,
      auth: signAssertion(arjunPasskey, liveness),
    }),
  });
  ok(`signed on Arjun's own phone in ${proved.latencyMs}ms`);

  family = await api(`/family/${familyId}`);
  assert(family.checkNonce === "0", "Kavya can see it was really him");

  log("11/15", "Woah 3: the family reports the payee, and the next family is warned");
  // A report is only possible because Kavya actually cancelled hold 1.
  const handle = keccak256(encodePacked(["address"], [SCAMMER]));
  const reportChal = reportChallenge(
    config.chainId,
    config.scamSignals,
    familyId,
    handle,
    1,
    holdId,
  );
  await api("/report", {
    method: "POST",
    body: JSON.stringify({
      familyId: String(familyId),
      handleHash: handle,
      scriptId: 1,
      holdId: String(holdId),
      auth: signAssertion(ammaPasskey, reportChal),
    }),
  });
  const signal = await api(`/signals/${SCAMMER}`);
  assert(signal.count === 1, `the network now knows this payee (${signal.count} family)`);

  // The same payee is now held for the network's reason instead of simply being new.
  const afterReport = await sendMoney(SCAMMER, 75, "one more");
  assert(
    afterReport.reasonName === "NETWORK_FLAG",
    `a reported payee raises the hold level (${afterReport.reasonName})`,
  );

  // And the honest limit: a flag never refuses on its own, so rent still pays.
  const rentAfter = await sendMoney(LANDLORD, 100, "rent top-up");
  assert(
    rentAfter.held === false,
    "a scheduled payee is still paid: flags escalate, they never block",
  );

  // ---- A new person by name and phone, with no address typed or shown.
  log("11b/15", "A new person by name and phone: no address is typed or shown, and network flags follow the contact");
  // A fresh number every run. The live chain remembers every report forever, so a fixed number would already be flagged.
  const tail = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const phone = `+91 98${tail.slice(0, 3)} ${tail.slice(3)}`; // +91 98xxx xxxx
  const phoneCompact = `+9198${tail}`;
  const phoneDashed = `+91-98${tail.slice(0, 3)}-${tail.slice(3)}`;
  const maskedPhone = `+91 ••••• ${tail.slice(3)}`;
  const ravi = await api("/payee/resolve", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), name: "Ravi Kumar", contact: phone }),
  });
  assert(/^0x[0-9a-fA-F]{40}$/.test(ravi.address) && ravi.scheduled === false, "a name and a phone number became a payee");
  assert(ravi.contact === maskedPhone && !/0x/.test(ravi.contact), `the family sees "${ravi.name} (${ravi.contact})", never an address`);
  const raviAgain = await api("/payee/resolve", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), name: "Ravi", contact: phoneCompact }),
  });
  assert(raviAgain.address === ravi.address, "the same number typed another way is the same person");
  const badContact = await fetch(`${RELAYER_URL}/payee/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ familyId: String(familyId), name: "Ravi", contact: "9876543210" }),
  });
  assert(badContact.status === 400, "a phone number without a country code is refused");

  const raviSend = await sendMoney(ravi.address, 40, "a favour");
  assert(raviSend.held === true && raviSend.reasonName === "NEW_PAYEE", `a new person is held (${raviSend.reasonName})`);
  const raviHold = await api(`/hold/${raviSend.holdId}`);
  assert(
    raviHold.payeeName === "Ravi" && raviHold.payeeContact === maskedPhone,
    `Kavya's hold card reads "${raviHold.payeeName} (${raviHold.payeeContact})"`,
  );
  await api("/hold/resolve", {
    method: "POST",
    body: JSON.stringify({
      holdId: String(raviSend.holdId),
      release: false,
      auth: signAssertion(ammaPasskey, resolveHoldChallenge(config.chainId, config.thunaiVault, familyId, BigInt(raviSend.holdId), false)),
    }),
  });
  const raviHandle = keccak256(encodePacked(["address"], [ravi.address]));
  await api("/report", {
    method: "POST",
    body: JSON.stringify({
      familyId: String(familyId),
      handleHash: raviHandle,
      scriptId: 1,
      holdId: String(raviSend.holdId),
      auth: signAssertion(ammaPasskey, reportChallenge(config.chainId, config.scamSignals, familyId, raviHandle, 1, BigInt(raviSend.holdId))),
    }),
  });
  const raviOtherSpelling = await api("/payee/resolve", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), name: "R. Kumar", contact: phoneDashed }),
  });
  const raviFlagged = await sendMoney(raviOtherSpelling.address, 30, "again");
  assert(
    raviFlagged.reasonName === "NETWORK_FLAG",
    `a report follows the contact, however it is typed (${raviFlagged.reasonName})`,
  );

  // ---- What the Chainlink CRE workflow is allowed to ask of the agent.
  log("11c/15", "Chainlink CRE: the workflow's endpoints answer only its token, and each action re-checks the chain");
  const cre = (body, token = E2E_CRE) =>
    fetch(`${AGENT_URL}/cre/apply`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { "x-cre-token": token } : {}) },
      body: JSON.stringify(body),
    });
  assert((await cre({ action: "repage", id: String(raviFlagged.holdId) }, "")).status !== 200, "no token: refused");
  assert((await cre({ action: "repage", id: String(raviFlagged.holdId) }, "wrong-token-wrong-token-wrong")).status === 401, "wrong token: refused");
  if (E2E_CRE) {
    const bad = await cre({ action: "payEverybody", id: "1" });
    assert(bad.status === 400, "an action outside the three allowed is refused");
    const due = await (await cre({ action: "runAllowance", id: String(familyId) })).json();
    assert(due.ok === true && due.skipped === "not due", "an allowance that is not due is not sent");
    await sleep(1500);
    const again = await (await cre({ action: "repage", id: String(raviFlagged.holdId) })).json();
    assert(again.ok === true, `a still-open hold can be reminded about (${again.skipped ?? `${again.pagedDevices} devices`})`);
    const early = await (await cre({ action: "expireHold", id: String(raviFlagged.holdId) })).json();
    assert(early.ok === true, `an expiry request is checked against the chain's clock (${early.skipped ?? "expired, time was up"})`);
    const settled = await (await cre({ action: "expireHold", id: String(raviSend.holdId) })).json();
    assert(settled.skipped === "not open", "a hold that is already settled is left alone");
    const status = await (await fetch(`${AGENT_URL}/cre/status`, { headers: { "x-cre-token": E2E_CRE } })).json();
    assert(
      status.ok === true && (TESTNET ? ["keeper", "cre"].includes(status.orchestrator) : status.orchestrator === "cre"),
      `the agent reports its orchestrator (${status.orchestrator}); with cre, its own timer stays as a standby`,
    );
  } else {
    ok("(CRE_TOKEN is not set in .env, so the authorised calls were not exercised)");
  }

  log("12/15", "Silent SOS: one tap pauses everything and tells Kavya, whatever the scammer wants");
  const freezeInfo = await api(`/freeze/digest?familyId=${familyId}`);
  const duressSignature = await duressAcct.sign({ hash: freezeInfo.digest });
  const sos = await api("/freeze", {
    method: "POST",
    body: JSON.stringify({
      familyId: String(familyId),
      nonce: freezeInfo.nonce,
      signature: duressSignature,
      kind: "sos",
    }),
  });
  assert(typeof sos.room === "string" && sos.room.length >= 20, `SOS raised in ${sos.latencyMs}ms, private call room issued`);

  family = await api(`/family/${familyId}`);
  assert(family.frozen === true, "the family is frozen onchain");
  assert(family.sos?.room === sos.room, "both phones can read the same SOS and call room");

  // Money to a scheduled payee is paused too: every in-app outflow stops until she lifts it.
  const whileFrozen = await sendMoney(LANDLORD, 10, "while frozen").catch((error) => ({ error }));
  assert(Boolean(whileFrozen.error) || whileFrozen.held === true, "no money leaves the app while frozen");

  // The agent pages the guardian. No device is subscribed in this run, so we check the
  // message it would send, which is also the WhatsApp backstop.
  await new Promise((r) => setTimeout(r, 800));
  const paged = await (
    await fetch(`${AGENT_URL}/sos`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-token": E2E_INTERNAL },
      body: JSON.stringify({ familyId: String(familyId), room: sos.room }),
    })
  ).json();
  assert(paged.ok === true, "the agent builds the page");
  const decoded = decodeURIComponent(paged.whatsAppLink);
  assert(decoded.includes("Arjun pressed SOS"), "the page names who pressed SOS");
  assert(decoded.includes(`companion-${sos.room}`), "the page carries the private video-call link");

  // What the caller wants is optional, accepted once, and cannot be used to spam her.
  const detail = await api("/sos/detail", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), demand: "gift_card" }),
  });
  assert(detail.ok === true, "the student says it is a gift-card demand");
  const again = await fetch(`${RELAYER_URL}/sos/detail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ familyId: String(familyId), demand: "wire" }),
  });
  assert(again.status === 409, "a second detail is refused");

  // Only Kavya's passkey lifts it.
  const unfreezeInfo = await api(`/unfreeze/challenge?familyId=${familyId}`);
  await api("/unfreeze", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), auth: signAssertion(ammaPasskey, unfreezeInfo.challenge) }),
  });
  family = await api(`/family/${familyId}`);
  assert(family.frozen === false, "Kavya lifted the pause with her own Face ID");

  // ---- An Alchemy webhook is a second, chain-driven path to the parent.
  log("12b/15", "Alchemy webhook: a hold the relayer path missed still reaches the parent, exactly once");
  if (!E2E_ALCHEMY) {
    ok("(ALCHEMY_WEBHOOK_SIGNING_KEY is not set in .env, so the webhook route was not exercised)");
  } else {
    const hex32 = (n) => `0x${BigInt(n).toString(16).padStart(64, "0")}`;
    const webhook = (log, key = E2E_ALCHEMY, signed = true) => {
      const body = JSON.stringify({ webhookId: "wh_e2e", type: "GRAPHQL", event: { data: { block: { logs: [log] } }, network: "MONAD_TESTNET" } });
      const headers = { "content-type": "application/json" };
      if (signed) headers["x-alchemy-signature"] = createHmac("sha256", key).update(body).digest("hex");
      return fetch(`${AGENT_URL}/alchemy/webhook`, { method: "POST", headers, body });
    };
    const holdLog = (tx) => ({
      topics: [HOLD_OPENED_TOPIC, hex32(raviFlagged.holdId), hex32(familyId)],
      data: "0x",
      transaction: { hash: tx },
    });

    assert((await webhook(holdLog("0xe2e0"), E2E_ALCHEMY, false)).status === 401, "an unsigned webhook is refused");
    assert((await webhook(holdLog("0xe2e0"), "some-other-signing-key-0123456789")).status === 401, "a webhook signed with another key is refused");

    // The relayer already told the agent about this hold, so the webhook has nothing to add.
    const duplicate = await (await webhook(holdLog("0xe2e1"))).json();
    assert(duplicate.paged === 0 && duplicate.skipped === 1, "a hold the relayer path already reported is not paged again");

    // Forget the agent's briefing, as if the relayer's call to it had never arrived.
    await fetch(`${AGENT_URL}/hold-resolved`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-token": E2E_INTERNAL },
      body: JSON.stringify({ holdId: String(raviFlagged.holdId), released: false }),
    });
    assert((await fetch(`${AGENT_URL}/brief/${raviFlagged.holdId}`)).status === 404, "the agent has no briefing for the hold");
    const missed = await (await webhook(holdLog("0xe2e2"))).json();
    assert(missed.paged === 1, "the webhook reaches the parent for a hold the relayer path missed");
    const rebuilt = await (await fetch(`${AGENT_URL}/brief/${raviFlagged.holdId}`)).json();
    assert(rebuilt.holdId === String(raviFlagged.holdId) && rebuilt.alert?.url?.includes(`/hold/${raviFlagged.holdId}`), "the parent's alert links straight to the hold");

    assert((await (await webhook(holdLog("0xe2e2"))).json()).skipped === 1, "the same delivery twice pages once");
    assert((await (await webhook(holdLog("0xe2e3"))).json()).paged === 0, "a second event for the same hold does not page again");

    // The SOS beat just ran, so the relayer path already paged it.
    const sosAgain = await (await webhook({ topics: [SOS_RAISED_TOPIC, hex32(familyId)], data: "0x", transaction: { hash: "0xe2e4" } })).json();
    assert(sosAgain.paged === 0 && sosAgain.skipped === 1, "an SOS the relayer path already paged is not paged again");
  }

  log("13/15", "Stateless: clear storage, then one Face ID brings back the family and the encrypted notes");
  // The notes key is the passkey's PRF output for the fixed salt keccak256("thunai/notes"). A real
  // authenticator computes that on the phone, which this script cannot do, so a deterministic
  // stand-in derived from the passkey and the same salt plays the authenticator. What it proves
  // is everything around it: the real encryption code, the real contract storage and the real
  // read-back. The PRF itself is only verified on a physical phone.
  const { encryptNotes, decryptNotes } = await import("../packages/shared/src/notes.ts");
  const notesSalt = Buffer.from(keccak256(toHex("thunai/notes")).slice(2), "hex");
  const prfFor = (passkey) =>
    new Uint8Array(createHash("sha256").update(Buffer.concat([Buffer.from(passkey.privateKey), notesSalt])).digest());

  // Device A: Kavya writes the family question. It is encrypted, then stored by her passkey.
  const questionText = "What was our first dog called?";
  const ciphertext = await encryptNotes(prfFor(ammaPasskey), { familyQuestion: questionText });
  assert(!ciphertext.includes(Buffer.from(questionText).toString("hex")), "the stored blob is ciphertext, not the question");
  const notesChal = await api(`/notes/challenge?familyId=${familyId}&role=1&ciphertext=${ciphertext}`);
  const notesTx = await api("/notes", {
    method: "POST",
    body: JSON.stringify({
      familyId: String(familyId),
      role: 1,
      ciphertext,
      auth: signAssertion(ammaPasskey, notesChal.challenge),
    }),
  });
  ok(`notes stored onchain by her passkey (${notesTx.latencyMs}ms)`);

  // "Forget this device": nothing from device A is used below. A fresh device knows only the
  // passkey. The family comes from the chain by her address, the ciphertext from the contract.
  const restored = await api(`/family/by-account/${ammaAcct.address}`);
  assert(restored.familyId === String(familyId) && restored.role === "guardian", "one passkey finds the family again");
  const restoredFamily = await api(`/family/${familyId}`);
  assert(restoredFamily.env.weeklyAmount === String(USD(150)), "the signed envelope is read back from the chain");
  assert(restoredFamily.frozen === false, "the family state is read back from the chain");
  const storedNotes = await api(`/notes/${familyId}/1`);
  assert(storedNotes.version === "1", "the contract holds version 1 of her notes");
  const opened = await decryptNotes(prfFor(ammaPasskey), storedNotes.ciphertext);
  assert(opened.familyQuestion === questionText, "a fresh device decrypts the family question with the same passkey");

  // Nobody else can: not Arjun's key, and not a tampered blob.
  let wrongKeyRejected = false;
  try {
    await decryptNotes(prfFor(arjunPasskey), storedNotes.ciphertext);
  } catch {
    wrongKeyRejected = true;
  }
  assert(wrongKeyRejected, "Arjun's key cannot open Kavya's notes");
  const flipped = `${storedNotes.ciphertext.slice(0, -2)}${storedNotes.ciphertext.endsWith("00") ? "01" : "00"}`;
  let tamperRejected = false;
  try {
    await decryptNotes(prfFor(ammaPasskey), flipped);
  } catch {
    tamperRejected = true;
  }
  assert(tamperRejected, "an altered blob is rejected, not silently misread");

  // A second write needs a fresh assertion and bumps the version.
  const secondNotes = await encryptNotes(prfFor(ammaPasskey), { familyQuestion: questionText, familyAnswerHint: "starts with B" });
  const secondChal = await api(`/notes/challenge?familyId=${familyId}&role=1&ciphertext=${secondNotes}`);
  await api("/notes", {
    method: "POST",
    body: JSON.stringify({ familyId: String(familyId), role: 1, ciphertext: secondNotes, auth: signAssertion(ammaPasskey, secondChal.challenge) }),
  });
  const latest = await api(`/notes/${familyId}/1`);
  assert(latest.version === "2", "the second write is version 2");
  const replay = await fetch(`${RELAYER_URL}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ familyId: String(familyId), role: 1, ciphertext: secondNotes, auth: signAssertion(ammaPasskey, notesChal.challenge) }),
  });
  assert(replay.status >= 400, "an old assertion cannot roll the notes back");

  log("14/15", "Lock-down: dev endpoints, webhooks and deposits answer only the right caller");
  const post = (url, headers = {}, body = {}) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

  // /fund spends the relayer's float. It needs the admin token.
  const fundBodyJson = { familyId: String(familyId), amount: "1000000", settle: true };
  assert((await post(`${RELAYER_URL}/fund`, {}, fundBodyJson)).status === 401, "/fund refuses a caller with no admin token");
  assert((await post(`${RELAYER_URL}/fund`, { "x-admin-token": "wrong-wrong-wrong-wrong" }, fundBodyJson)).status === 401, "/fund refuses a wrong token");
  assert((await post(`${RELAYER_URL}/fund`, { "x-admin-token": E2E_ADMIN }, fundBodyJson)).ok, "/fund works with the admin token");

  // The agent's webhooks and dev routes, which the public tunnel would otherwise expose.
  assert((await post(`${AGENT_URL}/sos`, {}, { familyId: String(familyId) })).status === 401, "agent /sos refuses a caller without the internal token");
  assert((await post(`${AGENT_URL}/hold-opened`, {}, {})).status === 401, "agent /hold-opened refuses a stranger");
  assert((await post(`${AGENT_URL}/keeper/tick`, {})).status === 401, "agent /keeper/tick needs the admin token");
  assert((await post(`${AGENT_URL}/classify`, {}, {})).status === 401, "agent /classify needs the admin token");
  assert((await fetch(`${RELAYER_URL}/subscriptions/${familyId}`)).status === 401, "push subscriptions are not public");

  // With no tokens configured, the dev endpoints do not exist and the webhooks fail closed.
  const openEnv = {
    ...process.env,
    PORT: "8797",
    MONAD_RPC_URL: RPC,
    RELAYER_PRIVATE_KEY: DEPLOYER_PK,
    THUNAI_VAULT_ADDRESS: deployment.thunaiVault,
    SCAM_SIGNALS_ADDRESS: deployment.scamSignals,
    DATA_DIR: join(root, ".data-e2e-open"),
    AGENT_URL,
    DEV_ADMIN_TOKEN: "",
    INTERNAL_TOKEN: "",
    TESTNET_PARTNER_STANDIN: "false",
    LOG_LEVEL: "warn",
  };
  spawnProc("relayer-unconfigured", "pnpm", ["exec", "tsx", "src/index.ts"], { cwd: join(root, "relayer"), env: openEnv });
  await waitFor("unconfigured relayer", async () => (await fetch("http://127.0.0.1:8797/health")).ok);
  assert((await post("http://127.0.0.1:8797/fund", {}, fundBodyJson)).status === 404, "with no DEV_ADMIN_TOKEN, /fund does not exist");
  assert((await fetch("http://127.0.0.1:8797/subscriptions/1")).status === 503, "with no INTERNAL_TOKEN, internal routes fail closed");
  assert((await fetch("http://127.0.0.1:8797/partner/digest?familyId=1&amount=1")).status === 404, "the testnet partner stand-in is off unless enabled");

  // The guardian's own deposit: authorised by her account key, capped, replay-proof.
  const partnerAmount = USD(40);
  const pd = await api(`/partner/digest?familyId=${familyId}&amount=${partnerAmount}`);
  const guardianSig = await ammaAcct.sign({ hash: pd.digest });
  const depositBody = { familyId: String(familyId), amount: String(partnerAmount), nonce: pd.nonce, deadline: pd.deadline };
  const strangerSig = await arjunAcct.sign({ hash: pd.digest });
  assert((await post(`${RELAYER_URL}/partner/deposit`, {}, { ...depositBody, signature: strangerSig })).status === 401, "a deposit signed by anyone but the guardian is refused");
  const familyBeforeDeposit = await api(`/family/${familyId}`);
  const deposited = await post(`${RELAYER_URL}/partner/deposit`, {}, { ...depositBody, signature: guardianSig });
  assert(deposited.ok, "the guardian's own signature deposits for her family");
  const balanceAfterDeposit = (await api(`/family/${familyId}`)).balance;
  // On a live deployment the keeper may return an expired hold's money in the same moment, so those refunds are
  // subtracted: whatever is left must be exactly the deposit.
  let refundedMeanwhile = 0n;
  for (const id of familyBeforeDeposit.openHolds ?? []) {
    const h = await api(`/hold/${id}`);
    if (h.statusName === "EXPIRED" || h.statusName === "CANCELLED") refundedMeanwhile += BigInt(h.amount);
  }
  assert(
    BigInt(balanceAfterDeposit) - BigInt(familyBeforeDeposit.balance) - refundedMeanwhile === partnerAmount,
    `the student's balance rose by exactly that amount${refundedMeanwhile ? " (plus a hold the keeper returned meanwhile)" : ""}`,
  );
  assert((await post(`${RELAYER_URL}/partner/deposit`, {}, { ...depositBody, signature: guardianSig })).status === 409, "the same signed deposit cannot be replayed");
  const tooBig = await api(`/partner/digest?familyId=${familyId}&amount=${USD(5000)}`);
  const tooBigSig = await ammaAcct.sign({ hash: tooBig.digest });
  assert(
    (await post(`${RELAYER_URL}/partner/deposit`, {}, { familyId: String(familyId), amount: String(USD(5000)), nonce: tooBig.nonce, deadline: tooBig.deadline, signature: tooBigSig })).status === 400,
    "a deposit above the cap is refused",
  );

  log("15/15", "Web push: only a family member's own key can subscribe a device to alerts");
  const { subscribeDigest } = await import("../packages/shared/src/subscribe.ts");
  const pushEndpoint = "https://push.example.invalid/send/e2e-device-1";
  const fakeKeys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
  const pushDigest = subscribeDigest(familyId, "guardian", pushEndpoint);
  const subBody = { familyId: String(familyId), role: "guardian", endpoint: pushEndpoint, keys: fakeKeys };

  assert((await post(`${RELAYER_URL}/subscribe`, {}, subBody)).status === 400, "a subscription with no signature is refused");
  const byStudent = await arjunAcct.sign({ hash: pushDigest });
  assert((await post(`${RELAYER_URL}/subscribe`, {}, { ...subBody, signature: byStudent })).status === 401, "the student's key cannot subscribe a device as the guardian");
  const byGuardian = await ammaAcct.sign({ hash: pushDigest });
  assert((await post(`${RELAYER_URL}/subscribe`, {}, { ...subBody, signature: byGuardian })).ok, "the guardian's own key subscribes her device");
  const listed = await (await fetch(`${RELAYER_URL}/subscriptions/${familyId}`, { headers: { "x-internal-token": E2E_INTERNAL } })).json();
  assert(listed.subscriptions.some((x) => x.endpoint === pushEndpoint && x.role === "guardian"), "the agent can list her device to page it");
  const cfg = await api("/config");
  assert(cfg.vapidPublicKey === null || typeof cfg.vapidPublicKey === "string", `the public push key is served to browsers (${cfg.vapidPublicKey ? "set" : "not set"})`);

  if (TESTNET) {
    log("16/16", "ERC-8004: a verified save is recorded against the agent, by the family's own account");
    const before = await api("/agent-identity");
    ok(`agent #${before.agentId}, owned by ${before.owner}, ${before.verifiedSaves} verified saves so far`);
    assert(before.owner.toLowerCase() !== ammaAcct.address.toLowerCase(), "the family's account is a client, never the agent's owner");

    // Hold 1 was stopped by Kavya. A payment that was not stopped must not count as a save.
    const notStopped = await post(`${RELAYER_URL}/feedback/prepare`, {}, { familyId: String(familyId), holdId: String(second.holdId) });
    assert(notStopped.status === 409, "a hold that expired on its own is not a verified save");

    const prep = await api("/feedback/prepare", { method: "POST", body: JSON.stringify({ familyId: String(familyId), holdId: String(holdId) }) });
    const unsigned = {
      type: "eip1559",
      chainId: prep.chainId,
      to: prep.to,
      data: prep.data,
      nonce: prep.nonce,
      gas: BigInt(prep.gas),
      maxFeePerGas: BigInt(prep.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(prep.maxPriorityFeePerGas),
      value: 0n,
    };
    // Someone else's key cannot give this family's feedback.
    const forged = await arjunAcct.signTransaction(unsigned);
    assert((await post(`${RELAYER_URL}/feedback/submit`, {}, { familyId: String(familyId), holdId: String(holdId), rawTx: forged })).status === 401, "a transaction signed by another key is refused");
    // And the relayer cannot be used to send anything but the expected call.
    const wrongCall = await ammaAcct.signTransaction({ ...unsigned, data: "0x" });
    assert((await post(`${RELAYER_URL}/feedback/submit`, {}, { familyId: String(familyId), holdId: String(holdId), rawTx: wrongCall })).status === 400, "a different call is refused");

    const rawTx = await ammaAcct.signTransaction(unsigned);
    const submitted = await api("/feedback/submit", { method: "POST", body: JSON.stringify({ familyId: String(familyId), holdId: String(holdId), rawTx }) });
    ok(`feedback recorded by the guardian's own account (${submitted.latencyMs}ms)`);
    const after = await api("/agent-identity");
    assert(BigInt(after.verifiedSaves) === BigInt(before.verifiedSaves) + 1n, `the agent's reputation rose to ${after.verifiedSaves} verified saves`);
    assert((await post(`${RELAYER_URL}/feedback/prepare`, {}, { familyId: String(familyId), holdId: String(holdId) })).status === 409, "one save counts once");
  }

  // Opt-in (E2E_CRE_DEMO=1, testnet, local relayer and agent): leave a real hold open, run the Chainlink CRE simulation
  // against it, and save the output. The longer hold timeout is signed by the parent at the very end, so the
  // fail-safe beat above, which needs a short one, is unaffected.
  if (TESTNET && process.env.E2E_CRE_DEMO === "1") {
    log("CRE", "Chainlink CRE simulation against a real open hold");
    const longEnvelope = { ...envelope, holdTimeout: 900n, nextRunAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400) };
    const longJson = Object.fromEntries(Object.entries(longEnvelope).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));
    const longChallenge = envelopeChallenge(config.chainId, config.thunaiVault, familyId, longEnvelope);
    await api("/family/envelope", {
      method: "POST",
      body: JSON.stringify({ familyId: String(familyId), envelope: longJson, auth: signAssertion(ammaPasskey, longChallenge) }),
    });
    ok("the parent signed a 15-minute hold window");

    const digits = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
    const stranger = await api("/payee/resolve", {
      method: "POST",
      body: JSON.stringify({ familyId: String(familyId), name: "Caller", contact: `+1 415 ${digits.slice(0, 3)} ${digits.slice(3)}` }),
    });
    const demoHold = await sendMoney(stranger.address, 60, "immigration bond");
    assert(demoHold.held === true, `a payment to someone new is held (hold ${demoHold.holdId})`);
    const heldAt = Date.now();

    // The workflow reminds the parent once, in the minute after a hold has been open for 120 s.
    const waitMs = Math.max(0, 130_000 - (Date.now() - heldAt));
    ok(`waiting ${Math.round(waitMs / 1000)} s so the hold is old enough to be reminded about`);
    await sleep(waitMs);

    const bin = process.env.CRE_BIN || join(process.env.LOCALAPPDATA || "", "Programs", "cre", "cre.exe");
    const sim = spawnSync(
      bin,
      ["workflow", "simulate", "companion-orchestrator", "--target", "staging-settings", "--config", "./config.local.json", "--non-interactive", "--trigger-index", "0"],
      { cwd: join(root, "cre"), encoding: "utf8", timeout: 180_000 },
    );
    const output = `${sim.stdout ?? ""}${sim.stderr ?? ""}`.replace(/\[[0-9;]*m/g, "");
    writeFileSync(join(root, "docs", "cre-simulation.txt"), output);
    ok("simulation output saved to docs/cre-simulation.txt");
    assert(sim.status === 0 && output.includes("Workflow Simulation Result"), "the CRE simulation completed");
    assert(output.includes("Read Monad testnet:"), "the workflow read the vault on Monad testnet");
    assert(
      output.includes(`Hold ${demoHold.holdId} still waiting`) && output.includes("parent reminded"),
      `the workflow found the open hold and had the agent remind the parent (hold ${demoHold.holdId})`,
    );
  }

  if (TESTNET) {
    const byPath = {};
    for (const t of timings) (byPath[t.path] ??= []).push(t.latencyMs);
    const summary = Object.fromEntries(
      Object.entries(byPath).map(([path, values]) => {
        const sorted = [...values].sort((x, y) => x - y);
        return [path, { count: values.length, minMs: sorted[0], medianMs: sorted[Math.floor(sorted.length / 2)], maxMs: sorted[sorted.length - 1] }];
      }),
    );
    const all = timings.map((t) => t.latencyMs).sort((x, y) => x - y);
    const record = {
      ranAt: new Date().toISOString(),
      network: "Monad testnet",
      chainId: config.chainId,
      vault: config.thunaiVault,
      passed: !failed,
      confirmedTransactions: all.length,
      overallMedianMs: all[Math.floor(all.length / 2)],
      overallMinMs: all[0],
      overallMaxMs: all[all.length - 1],
      byEndpoint: summary,
    };
    writeFileSync(join(root, "docs", "e2e-testnet.json"), JSON.stringify(record, null, 2) + "\n");
    ok(`timings recorded to docs/e2e-testnet.json (median ${record.overallMedianMs}ms over ${all.length} transactions)`);
  }

  console.log(
    failed
      ? "\n\x1b[31mEnd-to-end run FAILED\x1b[0m\n"
      : "\n\x1b[32mEnd-to-end run passed: the whole rescue works on " + (TESTNET ? "the live Monad testnet" : "a local chain") + ".\x1b[0m\n",
  );
  cleanup();
  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error(`\n\x1b[31mEnd-to-end run errored:\x1b[0m ${error.message}`);
  if (process.env.E2E_VERBOSE) console.error(error);
  cleanup();
  process.exit(1);
}
