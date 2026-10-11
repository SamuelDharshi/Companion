#!/usr/bin/env node
/**
 * Plays the whole scene against the LIVE relayer and agent (so, on Monad testnet) and
 * records what really happened to frontend/data/demo.json.
 *
 * The landing page renders from that file, so every number on it is a real transaction
 * with a hash you can open in the explorer. Nothing on the page is typed in by hand.
 *
 * The family is fictional (Arjun and Kavya), the transactions are real. Its keys are
 * generated fresh for this run and thrown away when it ends: nothing here needs to
 * be kept, and none of it can be reused for anything else.
 *
 * Needs `pnpm dev` running (relayer on 8787, agent on 8788), the contracts deployed, the
 * relayer holding CTK, and the vault holding an AUSD float.
 *
 * Run: node scripts/seed-demo.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePacked, keccak256, parseUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPasskey, signAssertion } from "./lib/passkey.mjs";
import {
  envelopeChallenge,
  livenessChallenge,
  reportChallenge,
  resolveHoldChallenge,
} from "./lib/challenges.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELAYER_URL = process.env.RELAYER_URL || "http://127.0.0.1:8787";
const AGENT_URL = process.env.AGENT_URL || "http://127.0.0.1:8788";
const OUT = join(root, "frontend", "data", "demo.json");
const EXPLORER = "https://testnet.monadexplorer.com";

const USD = (n) => parseUnits(String(n), 6);

// /fund and /keeper/tick are dev endpoints. They need DEV_ADMIN_TOKEN, from the environment
// or from .env, and are switched off on a service that has none.
function adminToken() {
  if (process.env.DEV_ADMIN_TOKEN) return process.env.DEV_ADMIN_TOKEN;
  try {
    const line = readFileSync(join(root, ".env"), "utf8").split("\n").find((l) => l.startsWith("DEV_ADMIN_TOKEN="));
    return line ? line.slice("DEV_ADMIN_TOKEN=".length).trim() : "";
  } catch {
    return "";
  }
}
const ADMIN = { "x-admin-token": adminToken() };
const randomHex = () => generatePrivateKey();
const step = (n, text) => console.log(`\n\x1b[36m${n}\x1b[0m ${text}`);
const ok = (text) => console.log(`  \x1b[32mok\x1b[0m   ${text}`);

async function call(base, path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
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
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${body.error ?? text}`);
  return body;
}
const api = (path, init) => call(RELAYER_URL, path, init);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------

const config = await api("/config");
if (config.chainId !== 10143) {
  throw new Error(`This script records testnet evidence. The relayer is on chain ${config.chainId}.`);
}
ok(`relayer on Monad testnet (${config.chainId}), vault ${config.thunaiVault}`);

// Fresh keys, held only in memory for this run.
const studentPasskey = createPasskey(randomHex());
const guardianPasskey = createPasskey(randomHex());
const studentAcct = privateKeyToAccount(randomHex());
const guardianAcct = privateKeyToAccount(randomHex());
const duressAcct = privateKeyToAccount(randomHex());
const landlord = privateKeyToAccount(randomHex()).address;
const scammer = privateKeyToAccount(randomHex()).address;

const steps = [];
const record = (entry) => steps.push({ at: new Date().toISOString(), ...entry });

// ---- 1. onboarding -------------------------------------------------------
step("1/7", "Onboarding: one passkey each");
const invited = await api("/onboard/student", {
  method: "POST",
  body: JSON.stringify({
    studentPasskey: { x: `0x${studentPasskey.x}`, y: `0x${studentPasskey.y}` },
    studentAcct: studentAcct.address,
    duressAddr: duressAcct.address,
    studentName: "Arjun",
  }),
});
const registered = await api("/onboard/guardian", {
  method: "POST",
  body: JSON.stringify({
    inviteCode: invited.inviteCode,
    guardianPasskey: { x: `0x${guardianPasskey.x}`, y: `0x${guardianPasskey.y}` },
    guardianAcct: guardianAcct.address,
    guardianName: "Kavya",
  }),
});
const familyId = BigInt(registered.familyId);
record({ kind: "family_registered", txHash: registered.txHash, latencyMs: registered.latencyMs });
ok(`family ${familyId} registered in ${registered.latencyMs}ms`);

// ---- 2. the signed schedule ----------------------------------------------
step("2/7", "Kavya signs the weekly envelope");
const payees = await api("/payees", {
  method: "POST",
  body: JSON.stringify({ familyId: String(familyId), address: landlord, name: "Landlord", scheduled: true }),
});
const now = Math.floor(Date.now() / 1000);
const envelope = {
  weeklyAmount: USD(150),
  perWithdrawalCap: USD(1000),
  payeesRoot: payees.payeesRoot,
  cadence: 604800n,
  holdTimeout: 1800n,
  expiry: BigInt(now + 365 * 86400),
  nextRunAt: BigInt(now),
};
const envelopeJson = Object.fromEntries(
  Object.entries(envelope).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]),
);
const envelopeSigned = await api("/family/envelope", {
  method: "POST",
  body: JSON.stringify({
    familyId: String(familyId),
    envelope: envelopeJson,
    auth: signAssertion(
      guardianPasskey,
      envelopeChallenge(config.chainId, config.thunaiVault, familyId, envelope),
    ),
  }),
});
record({ kind: "envelope_set", txHash: envelopeSigned.txHash, latencyMs: envelopeSigned.latencyMs });
ok(`envelope set: $150 a week, $1,000 cap (${envelopeSigned.latencyMs}ms)`);

// ---- 3. money from home, then the weekly run -----------------------------
step("3/7", "Money from home arrives, and the weekly allowance runs");
const funded = await api("/fund", {
  method: "POST",
  headers: ADMIN,
  body: JSON.stringify({ familyId: String(familyId), amount: String(USD(600)), settle: false }),
});
record({ kind: "funded_home", amount: 600, txHash: funded.txHash, latencyMs: funded.latencyMs });
ok(`$600 deposited from home (${funded.latencyMs}ms)`);

const beforeRun = await api(`/family/${familyId}`);
const tick = await call(AGENT_URL, "/keeper/tick", { method: "POST", headers: ADMIN });
await sleep(1500);
const afterRun = await api(`/family/${familyId}`);
record({
  kind: "allowance_run",
  amount: 150,
  balanceBefore: beforeRun.balanceLabel,
  balanceAfter: afterRun.balanceLabel,
  keeper: tick,
});
ok(`allowance run: student balance ${beforeRun.balanceLabel} -> ${afterRun.balanceLabel}`);

const topUp = await api("/fund", {
  method: "POST",
  headers: ADMIN,
  body: JSON.stringify({ familyId: String(familyId), amount: String(USD(300)), settle: true }),
});
record({ kind: "funded_settled", amount: 300, txHash: topUp.txHash, latencyMs: topUp.latencyMs });
ok(`$300 more, settled instantly (${topUp.latencyMs}ms)`);

// ---- helper: a signed withdrawal from the student -------------------------
async function sendMoney(to, amountUsd, memo) {
  const digest = await api(
    `/withdraw/digest?familyId=${familyId}&to=${to}&amount=${USD(amountUsd)}&memo=${encodeURIComponent(memo)}`,
  );
  const signature = await studentAcct.sign({ hash: digest.digest });
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

// ---- 4. rent pays itself --------------------------------------------------
step("4/7", "Rent pays itself: the landlord is on the signed schedule");
const rent = await sendMoney(landlord, 250, "rent");
if (rent.held) throw new Error("Rent was held; the landlord should be on the schedule.");
record({ kind: "rent_paid", amount: 250, to: "Landlord", txHash: rent.txHash, latencyMs: rent.latencyMs });
ok(`$250 rent paid straight through (${rent.latencyMs}ms)`);

// ---- 5. the scam ----------------------------------------------------------
step("5/7", "A new payee: held, explained, stopped");
const beforeHold = await api(`/family/${familyId}`);
const bond = await sendMoney(scammer, 120, "immigration bond");
if (!bond.held) throw new Error("The payment to a new payee should have been held.");
const holdId = BigInt(bond.holdId);
const hold = await api(`/hold/${holdId}`);
record({
  kind: "hold_opened",
  amount: 120,
  reason: bond.reasonName,
  holdId: String(holdId),
  txHash: bond.txHash,
  latencyMs: bond.latencyMs,
  balanceBefore: beforeHold.balanceLabel,
});
ok(`held in ${bond.latencyMs}ms, reason ${bond.reasonName}`);

await sleep(4000); // the relayer hands the hold to the agent without waiting on it
let brief = null;
try {
  brief = await (await fetch(`${AGENT_URL}/brief/${holdId}`)).json();
  ok(`agent brief: ${brief.classification?.scriptId} via ${brief.classifierSource}`);
} catch {
  ok("no agent brief available");
}

const heldFamily = await api(`/family/${familyId}`);
const stopped = await api("/hold/resolve", {
  method: "POST",
  body: JSON.stringify({
    holdId: String(holdId),
    release: false,
    auth: signAssertion(
      guardianPasskey,
      resolveHoldChallenge(config.chainId, config.thunaiVault, familyId, holdId, false),
    ),
  }),
});
const afterStop = await api(`/family/${familyId}`);
const resolvedHold = await api(`/hold/${holdId}`);
record({
  kind: "hold_stopped",
  amount: 120,
  status: resolvedHold.statusName,
  txHash: stopped.txHash,
  latencyMs: stopped.latencyMs,
  balanceWhileHeld: heldFamily.balanceLabel,
  balanceAfter: afterStop.balanceLabel,
});
ok(`stopped with Face ID in ${stopped.latencyMs}ms; balance ${heldFamily.balanceLabel} -> ${afterStop.balanceLabel}`);

// ---- 6. check on the student ---------------------------------------------
step("6/7", "Check on Arjun");
const check = await api("/check/request", { method: "POST", body: JSON.stringify({ familyId: String(familyId) }) });
const proved = await api("/check/prove", {
  method: "POST",
  body: JSON.stringify({
    familyId: String(familyId),
    nonce: check.nonce,
    auth: signAssertion(
      studentPasskey,
      livenessChallenge(config.chainId, config.thunaiVault, familyId, check.nonce),
    ),
  }),
});
record({ kind: "check_requested", txHash: check.txHash, latencyMs: check.latencyMs });
record({ kind: "check_proved", txHash: proved.txHash, latencyMs: proved.latencyMs });
ok(`Arjun answered in ${proved.latencyMs}ms`);

// ---- 7. the family reports the payee -------------------------------------
step("7/7", "The family reports the payee");
const handle = keccak256(encodePacked(["address"], [scammer]));
const reported = await api("/report", {
  method: "POST",
  body: JSON.stringify({
    familyId: String(familyId),
    handleHash: handle,
    scriptId: 1,
    holdId: String(holdId),
    auth: signAssertion(
      guardianPasskey,
      reportChallenge(config.chainId, config.scamSignals, familyId, handle, 1, holdId),
    ),
  }),
});
record({ kind: "payee_reported", txHash: reported.txHash, latencyMs: reported.latencyMs });
ok(`reported (${reported.latencyMs}ms)`);

// ---- write the evidence ---------------------------------------------------
const finalFamily = await api(`/family/${familyId}`);
const evidence = {
  note: "A fictional family (Arjun and Kavya) played through real Monad testnet transactions. Generated by scripts/seed-demo.mjs.",
  generatedAt: new Date().toISOString(),
  network: "Monad testnet",
  chainId: config.chainId,
  explorer: EXPLORER,
  vault: config.thunaiVault,
  scamSignals: config.scamSignals,
  familyId: String(familyId),
  student: { name: "Arjun", account: studentAcct.address },
  guardian: { name: "Kavya", account: guardianAcct.address },
  final: {
    balanceLabel: finalFamily.balanceLabel,
    homeBalanceLabel: finalFamily.homeBalanceLabel,
    weeklyAmount: 150,
    openHolds: finalFamily.openHolds.length,
  },
  hold: {
    id: String(holdId),
    amountLabel: hold.amountLabel,
    reasonName: hold.reasonName,
    statusAfter: resolvedHold.statusName,
    memo: "immigration bond",
    secondsToResolve: resolvedHold.secondsToResolve ?? null,
  },
  brief: brief
    ? {
        scriptId: brief.classification?.scriptId ?? null,
        source: brief.classifierSource ?? null,
        explanation: brief.classification?.explanation_en ?? null,
        alertTitle: brief.alert?.title ?? null,
        alertBody: brief.alert?.body ?? null,
      }
    : null,
  steps,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(evidence, null, 2) + "\n");
console.log(`\n\x1b[32mWrote ${OUT}\x1b[0m`);
console.log(`Family ${familyId}: balance ${finalFamily.balanceLabel}, ${steps.length} real transactions recorded.`);
