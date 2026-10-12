import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  keccak256,
  parseTransaction,
  recoverAddress,
  recoverTransactionAddress,
  stringToBytes,
  type Address,
  type Hex,
  type TransactionSerializable,
} from "viem";
import {
  HOLD_REASON_NAME,
  HOLD_STATUS_NAME,
  buildPayeeTree,
  formatUsd,
  handleHash as toHandleHash,
  maskContact,
  normalizeContact,
  payeeAddress,
} from "@thunai/shared";
import { subscribeDigest } from "@thunai/shared";
import {
  IdentityRegistryAbi,
  ReputationRegistryAbi,
  SAVE_TAG_1,
  SAVE_TAG_2,
  createChain,
  loadDeployment,
  loadErc8004,
  saveFeedbackCalldata,
  VaultService,
} from "@thunai/evm";
import { loadEnv } from "./env";
import { Store } from "./store";
import { TallyFollower } from "./tally";
import * as S from "./schemas";

const env = loadEnv();

const app = Fastify({
  logger: { level: env.LOG_LEVEL, transport: { target: "pino-pretty" } },
  // Receipts are small; keep the body limit tight.
  bodyLimit: 256 * 1024,
});

await app.register(cors, {
  origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
});

const chain = await createChain(
  { rpcUrl: env.MONAD_RPC_URL, fallbackRpcUrl: env.ALCHEMY_RPC_URL, privateKey: env.RELAYER_PRIVATE_KEY },
  app.log,
);
// Read the deployment for whichever chain the RPC actually is.
const deployment = loadDeployment(
  { thunaiVault: env.THUNAI_VAULT_ADDRESS, scamSignals: env.SCAM_SIGNALS_ADDRESS },
  chain.chainId,
);
const store = new Store(env.DATA_DIR);
// Turns a phone number or email into a payee address. Secret, so an address reveals nothing about the person.
const payeeSalt = (env.PAYEE_SALT ?? keccak256(stringToBytes(`${env.RELAYER_PRIVATE_KEY}companion/payee-salt`))) as Hex;
const vault = new VaultService(chain, deployment, (familyId) =>
  store.scheduledPayees(String(familyId)),
);

// Counts events from the chain for the public counters and the traction page.
const headNow = Number(await chain.publicClient.getBlockNumber());
const tallyStart = env.THUNAI_START_BLOCK > 0 ? env.THUNAI_START_BLOCK : Math.max(0, headNow - 400);
if (env.THUNAI_START_BLOCK === 0) {
  app.log.warn("THUNAI_START_BLOCK is not set, so event counts begin a few hundred blocks back, not at deployment.");
}
// Event counting reads logs in 100-block steps. If the main RPC refuses a range that wide, LOGS_RPC_URL points
// it at one that does, so the rest of the relayer can keep using the faster provider.
const logsClient = env.LOGS_RPC_URL ? createPublicClient({ transport: http(env.LOGS_RPC_URL) }) : chain.publicClient;
const tally = new TallyFollower(
  logsClient as typeof chain.publicClient,
  deployment.thunaiVault as Address,
  deployment.scamSignals as Address,
  tallyStart,
  env.DATA_DIR,
  // Our own end-to-end runs create the fictional Arjun and Kavya, counted apart from real families. A family this relayer
  // has no record of (its data was wiped by a restart) is "unknown", never "real": we only claim a real family we can see.
  (familyId) => {
    const record = store.getFamily(familyId);
    if (!record) return "unknown";
    return record.studentName === "Arjun" && record.guardianName === "Kavya" ? "test" : "real";
  },
  app.log,
);
tally.start();

/** bigints are not JSON-serialisable, so every response goes through this. */
function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

/** Turns a zod failure into a readable 400 instead of a 500. */
function parse<T extends { safeParse: (v: unknown) => any }>(schema: T, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = new Error(
      result.error.issues.map((i: any) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
    );
    (err as any).statusCode = 400;
    throw err;
  }
  return result.data;
}

/** Constant-time string comparison, so a token cannot be guessed one character at a time. */
function sameSecret(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Dev endpoints do not exist unless DEV_ADMIN_TOKEN is set, and need it when it is. */
function requireAdmin(request: { headers: Record<string, unknown> }, reply: { code: (n: number) => any }) {
  if (!env.DEV_ADMIN_TOKEN) {
    reply.code(404).send({ error: "Not found." });
    return false;
  }
  if (!sameSecret(request.headers["x-admin-token"], env.DEV_ADMIN_TOKEN)) {
    reply.code(401).send({ error: "Admin token required." });
    return false;
  }
  return true;
}

/** For calls that only the agent should make. Fails closed when no token is configured. */
function requireInternal(request: { headers: Record<string, unknown> }, reply: { code: (n: number) => any }) {
  if (!sameSecret(request.headers["x-internal-token"], env.INTERNAL_TOKEN)) {
    reply.code(env.INTERNAL_TOKEN ? 401 : 503).send({ error: "Internal endpoint." });
    return false;
  }
  return true;
}

/** Tells the agent a hold just opened, so it can classify and page the guardian. */
async function notifyAgent(path: string, payload: unknown) {
  try {
    await fetch(`${env.AGENT_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-token": env.INTERNAL_TOKEN ?? "" },
      body: JSON.stringify(json(payload)),
      signal: AbortSignal.timeout(4000),
    });
  } catch (error) {
    // The agent explains and pages; it never decides. If it is down, the hold still
    // stands and still expires safely, so this must not fail the user's request.
    app.log.warn({ err: (error as Error).message, path }, "agent notify failed (hold is unaffected)");
  }
}

// ---------------------------------------------------------------------- meta

/**
 * Everything the app needs to talk to the chain, so no address is compiled into the
 * client. `agoraEnabled` is reported honestly: the UI uses it to decide whether to claim
 * instant settlement or say it is using the disclosed fallback.
 */
app.get("/config", async () => {
  const [familyCount, relayerBalance] = await Promise.all([
    vault.familyCount(),
    chain.publicClient.getBalance({ address: chain.account.address }),
  ]);
  return json({
    chainId: chain.chainId,
    thunaiVault: deployment.thunaiVault,
    scamSignals: deployment.scamSignals,
    ctk: deployment.ctk,
    ausd: deployment.ausd,
    agoraPair: deployment.agoraPair,
    agoraEnabled: await vault.agoraEnabled().catch(() => deployment.agoraEnabled),
    standInTokens: deployment.standInTokens,
    relayerAddress: chain.account.address,
    relayerGasBalance: relayerBalance.toString(),
    /** Below this the relayer cannot send value (Monad's 10 MON reserve), so gas top-ups stop working. */
    relayerAboveReserve: relayerBalance > 11n * 10n ** 18n,
    syncSendSupported: chain.syncSupported() ?? null,
    /** Whether a failover RPC (Alchemy) is configured. A yes/no only: the URL holds a key and never leaves the server. */
    rpcFailover: Boolean(env.ALCHEMY_RPC_URL),
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    familyCount,
  });
});

app.get("/health", async () => ({ ok: true, uptime: process.uptime() }));

/**
 * The public counters, read straight from the contract. This is the fallback when the Envio indexer
 * is not available, and it is limited on purpose to what the contract can answer by itself: how many
 * families, how many holds, how many SOS presses. Anything that needs event history (scams stopped,
 * median save time) comes only from the indexer, and is simply absent here rather than guessed.
 */
app.get("/stats", async () => {
  const [familyCount, holdCount, sosCount] = await Promise.all([
    vault.familyCount(),
    vault.holdCount(),
    vault.sosCount(),
  ]);
  // The three totals come from the contract itself. The history comes from counting its events.
  const t = tally.snapshot;
  return json({
    source: "relayer",
    families: familyCount,
    holdsOpened: holdCount,
    sosRaised: sosCount,
    scamsStopped: t.scamsStopped,
    holdsExpired: t.holdsExpired,
    holdsReleased: t.holdsReleased,
    dollarsProtected: t.dollarsProtected,
    dollarsDelivered: t.dollarsDelivered,
    payoutsViaAgora: t.payoutsViaAgora,
    payoutsFallback: t.payoutsFallback,
    checksRequested: t.checksRequested,
    checksAnswered: t.checksAnswered,
    reportsFiled: t.reportsFiled,
    medianSaveSeconds: t.medianSaveSeconds,
    fastestSaveSeconds: t.fastestSaveSeconds,
    countedFromBlock: t.startBlock,
    countedToBlock: t.lastBlock,
  });
});

/**
 * Everything the traction page shows. Real families and our own test traffic are reported apart, so
 * no number here can quietly include us. Every count is an event the contracts emitted.
 */
app.get("/traction", async () => {
  const t = tally.snapshot;
  return json({
    network: chain.chainId === 10143 ? "Monad testnet" : `chain ${chain.chainId}`,
    vault: deployment.thunaiVault,
    countedFromBlock: t.startBlock,
    countedToBlock: t.lastBlock,
    families: { total: t.families, real: t.realFamilies, test: t.testFamilies, unknown: t.unknownFamilies ?? 0 },
    holdsOpened: t.holdsOpened,
    scamsStopped: t.scamsStopped,
    holdsReleased: t.holdsReleased,
    holdsExpired: t.holdsExpired,
    dollarsProtected: t.dollarsProtected,
    medianSaveSeconds: t.medianSaveSeconds,
    fastestSaveSeconds: t.fastestSaveSeconds,
    checksRequested: t.checksRequested,
    checksAnswered: t.checksAnswered,
    reportsFiled: t.reportsFiled,
    sosRaised: t.sosRaised,
    recent: t.recent.slice(0, 15),
  });
});

// ----------------------------------------------------------------- families

/**
 * Step one of onboarding: the student has a passkey.
 *
 * Deliberately no chain write. The family is registered only once the guardian has
 * accepted with her own Face ID, so there is never a moment where a placeholder key sits
 * in the guardian slot, and the contract needs no function that can swap a passkey later.
 * This record holds public key material and controls no money.
 */
app.post("/onboard/student", async (request) => {
  const body = parse(S.onboardStudentBody, request.body);
  const inviteCode = randomBytes(8).toString("base64url");

  store.putPending({
    inviteCode,
    studentName: body.studentName,
    studentPasskey: body.studentPasskey,
    studentAcct: body.studentAcct,
    duressAddr: body.duressAddr,
    createdAt: Date.now(),
  });

  return json({ inviteCode });
});

/**
 * Step two: the guardian accepts, and the family is registered with two real passkeys.
 *
 * From this point only her Face ID can release a held payment, and the student's duress
 * key is the registered freeze authority.
 */
app.post("/onboard/guardian", async (request, reply) => {
  const body = parse(S.onboardGuardianBody, request.body);
  const pending = store.getPending(body.inviteCode);
  if (!pending) return reply.code(404).send({ error: "This invite link is not valid." });
  if (pending.familyId) {
    return reply.code(409).send({ error: "This family has already been set up." });
  }

  const { tx, familyId } = await vault.registerFamily({
    guardianPasskey: body.guardianPasskey as { x: Hex; y: Hex },
    studentPasskey: pending.studentPasskey as { x: Hex; y: Hex },
    studentAcct: pending.studentAcct as Address,
    guardianAcct: body.guardianAcct as Address,
    duressAddr: pending.duressAddr as Address,
  });

  store.upsertFamily({
    familyId: String(familyId),
    studentName: pending.studentName,
    guardianName: body.guardianName,
    payees: [],
    createdAt: Date.now(),
    inviteCode: body.inviteCode,
    inviteAccepted: true,
  });
  store.completePending(body.inviteCode, String(familyId));

  return json({
    familyId,
    studentName: pending.studentName,
    txHash: tx.hash,
    latencyMs: Math.round(tx.latencyMs),
    sync: tx.sync,
  });
});

/**
 * Resolves an invite link.
 *
 * Used by the guardian's phone to show whose family it is joining, and polled by the
 * student's phone to learn its family id the moment she accepts.
 */
app.get<{ Params: { code: string } }>("/invite/:code", async (request, reply) => {
  const pending = store.getPending(request.params.code);
  if (!pending) return reply.code(404).send({ error: "This invite link is not valid." });
  const family = pending.familyId ? store.getFamily(pending.familyId) : undefined;
  return json({
    familyId: pending.familyId ?? null,
    studentName: pending.studentName,
    guardianName: family?.guardianName ?? null,
    accepted: Boolean(pending.familyId),
  });
});

app.post<{ Params: { code: string } }>("/invite/:code/accept", async (request, reply) => {
  const family = store.acceptInvite(request.params.code);
  if (!family) return reply.code(404).send({ error: "This invite link is not valid." });
  return json({ familyId: family.familyId });
});

/** The exact bytes the guardian's passkey must sign for an envelope. */
app.post("/family/envelope-challenge", async (request) => {
  const body = parse(S.envelopeChallengeBody, request.body);
  const challenge = await vault.envelopeChallenge(body.familyId, body.envelope as never);
  return json({ challenge });
});

/** The guardian's one-time envelope, authorised by Face ID and verified onchain. */
app.post("/family/envelope", async (request) => {
  const body = parse(S.setEnvelopeBody, request.body);
  const tx = await vault.setEnvelope(body.familyId, body.envelope as never, body.auth as never);
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

/**
 * Full family state for a screen.
 *
 * Note what this does NOT need: any server-side session. One Face ID on a fresh device
 * derives the same addresses, and everything else is read from chain right here.
 */
app.get<{ Params: { id: string } }>("/family/:id", async (request, reply) => {
  const familyId = BigInt(request.params.id);
  const onchain = await vault.readFamily(familyId).catch(() => null);
  if (!onchain) return reply.code(404).send({ error: "No such family." });

  const record = store.getFamily(request.params.id);
  // Pending decisions come from the contract, never the indexer: a stale "nothing is
  // waiting" is the one thing this screen must never show.
  const openHolds = await vault.openHolds(familyId).catch(() => []);
  return json({
    familyId,
    ...onchain,
    openHolds: openHolds.map(String),
    balanceLabel: formatUsd(onchain.balance),
    homeBalanceLabel: formatUsd(onchain.homeBalance),
    studentName: record?.studentName ?? "Student",
    guardianName: record?.guardianName ?? "Guardian",
    payees: record?.payees ?? [],
    inviteCode: record?.inviteCode,
    inviteAccepted: record?.inviteAccepted ?? false,
    sos: record?.sos,
    allowanceDue: await vault.allowanceDue(familyId).catch(() => false),
  });
});

/**
 * Which family this passkey belongs to.
 *
 * This is what makes the stateless restore complete: one Face ID yields the account
 * address, and this turns that address back into a family id, read from chain. Nothing
 * had to be remembered on the device or kept in a session on the server.
 */
app.get<{ Params: { address: string } }>("/family/by-account/:address", async (request) => {
  const found = await vault.findFamilyByAccount(request.params.address as Address);
  return json({ familyId: found ? found.familyId : null, role: found ? found.role : null });
});

/**
 * "Send money now", and the weekly top-up.
 *
 * The relayer's CTK float stands in for the licensed LRS partner that would deliver
 * dollars in production. A resident Indian parent never buys a token in this flow, on
 * testnet or otherwise, and the tokens are labelled stand-ins.
 */
app.post("/fund", async (request, reply) => {
  // A dev endpoint: it spends the relayer's stand-in float. It does not exist without the token.
  if (!requireAdmin(request, reply)) return;
  const body = parse(S.fundBody, request.body);
  const tx = await vault.fund(body.familyId, body.amount, body.settle);
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

// ------------------------------------------------------------------- payees

/**
 * Registers a payee and returns the resulting schedule root.
 *
 * The root is what the guardian signs in the envelope, so adding a payee always implies
 * a fresh envelope signature. The route returns the new root rather than applying it,
 * because only the guardian can authorise the change.
 */
app.post("/payees", async (request) => {
  const body = parse(S.addPayeeBody, request.body);
  const familyId = String(body.familyId);
  let payeeAddr = body.address as Address | undefined;
  let masked: string | undefined;
  if (body.contact) {
    const contact = contactOr400(body.contact);
    payeeAddr = payeeAddress(payeeSalt, contact);
    masked = maskContact(contact);
  }
  if (!store.getFamily(familyId)) {
    store.upsertFamily({
      familyId,
      studentName: "Student",
      guardianName: "Guardian",
      payees: [],
      createdAt: Date.now(),
    });
  }
  store.addPayee(familyId, {
    address: payeeAddr as Address,
    name: body.name,
    scheduled: body.scheduled,
    ...(masked ? { contact: masked } : {}),
  });

  const tree = buildPayeeTree(store.scheduledPayees(familyId));
  return json({
    payees: store.getFamily(familyId)?.payees ?? [],
    payeesRoot: tree.root,
    note: "The guardian must sign a new envelope for this root to take effect.",
  });
});

/** Reads a contact the way a family typed it, turning a bad one into a plain 400. */
function contactOr400(raw: string) {
  try {
    return normalizeContact(raw);
  } catch (cause) {
    const err = new Error((cause as Error).message);
    (err as any).statusCode = 400;
    throw err;
  }
}

/**
 * "Someone new" without an address. The student types a name and a phone number or email; this returns the address
 * to pay and remembers the name and a masked contact for this family, so the parent's screen says "Ravi, +91 •••••
 * 3210" and never a string of hex. A payee the parent already approved comes back marked `scheduled`, which is what
 * lets the app say "this pays straight through" before anything is sent.
 */
app.post("/payee/resolve", async (request, reply) => {
  const body = parse(S.resolvePayeeBody, request.body);
  const familyId = String(body.familyId);
  const family = store.getFamily(familyId);
  if (!family) return reply.code(404).send({ error: "No such family." });

  const contact = contactOr400(body.contact);
  const address = payeeAddress(payeeSalt, contact);
  const masked = maskContact(contact);
  const existing = family.payees.find((p) => p.address.toLowerCase() === address.toLowerCase());

  if (!existing) {
    if (family.payees.length >= 50) return reply.code(400).send({ error: "Too many people saved for this family." });
    store.addPayee(familyId, { address, name: body.name, scheduled: false, contact: masked });
  } else if (!existing.scheduled) {
    store.addPayee(familyId, { ...existing, name: body.name, contact: masked });
  } else if (!existing.contact) {
    store.addPayee(familyId, { ...existing, contact: masked });
  }

  const record = store.getFamily(familyId)?.payees.find((p) => p.address.toLowerCase() === address.toLowerCase());
  return json({
    address,
    name: record?.name ?? body.name,
    contact: masked,
    kind: contact.kind,
    scheduled: record?.scheduled ?? false,
  });
});

app.get<{ Params: { id: string } }>("/payees/:id", async (request) => {
  const familyId = request.params.id;
  const tree = buildPayeeTree(store.scheduledPayees(familyId));
  return json({ payees: store.getFamily(familyId)?.payees ?? [], payeesRoot: tree.root });
});

// -------------------------------------------------------------- withdrawals

/**
 * The hot path: the student sends money.
 *
 * Pays straight through for a scheduled payee; otherwise the contract opens a cooling
 * hold and the agent is told to classify it and page the guardian. The decision is the
 * contract's, taken before the classifier ever runs.
 */
app.post("/withdraw", async (request) => {
  const body = parse(S.withdrawBody, request.body);
  const memoHash = VaultService.memoHash(body.memo);

  const { tx, holdId, reason } = await vault.withdraw({
    familyId: body.familyId,
    to: body.to as Address,
    amount: body.amount,
    memoHash,
    nonce: body.nonce,
    deadline: body.deadline,
    signature: body.signature as Hex,
  });

  const held = holdId > 0n;
  if (held) {
    const flag = await vault.flagged(toHandleHash(body.to as Address)).catch(() => ({ count: 0, lastAt: 0 }));
    // Fire and forget: the family must not wait on the classifier to see the hold.
    void notifyAgent("/hold-opened", {
      familyId: body.familyId,
      holdId,
      to: body.to,
      payeeName: store.payeeLabel(String(body.familyId), body.to as Address),
      amount: body.amount,
      memo: body.memo,
      reason,
      reasonName: HOLD_REASON_NAME[reason],
      localHour: body.localHour,
      callDurationMinutes: body.callDurationMinutes,
      networkFlagCount: flag.count,
    });
  }

  return json({
    held,
    holdId,
    reason,
    reasonName: HOLD_REASON_NAME[reason] ?? "NONE",
    txHash: tx.hash,
    latencyMs: Math.round(tx.latencyMs),
    sync: tx.sync,
  });
});

/** The digest the student's `thunai/acct` signs, plus the nonce to use. */
app.get<{ Querystring: { familyId: string; to: string; amount: string; memo?: string } }>(
  "/withdraw/digest",
  async (request) => {
    const { familyId, to, amount, memo = "" } = request.query;
    const id = BigInt(familyId);
    const nonce = await vault.withdrawNonce(id);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const memoHash = VaultService.memoHash(memo);
    const digest = await vault.withdrawDigest(id, to as Address, BigInt(amount), memoHash, deadline);
    return json({ digest, nonce, deadline, memoHash });
  },
);

// -------------------------------------------------------------------- holds

app.get<{ Params: { id: string } }>("/hold/:id", async (request, reply) => {
  const holdId = BigInt(request.params.id);
  const hold = await vault.readHold(holdId).catch(() => null);
  if (!hold || hold.status === 0) return reply.code(404).send({ error: "No such hold." });

  const flag = await vault.flagged(toHandleHash(hold.to)).catch(() => ({ count: 0, lastAt: 0 }));
  return json({
    holdId,
    ...hold,
    amountLabel: formatUsd(hold.amount),
    reasonName: HOLD_REASON_NAME[hold.reason],
    statusName: HOLD_STATUS_NAME[hold.status],
    payeeName: store.payeeName(String(hold.familyId), hold.to),
    payeeContact: store.payeeContact(String(hold.familyId), hold.to),
    networkFlagCount: flag.count,
    networkLastAt: flag.lastAt,
  });
});

/** The challenge the guardian's passkey signs to stop or allow a held payment. */
app.get<{ Querystring: { familyId: string; holdId: string; release: string } }>(
  "/hold/challenge",
  async (request) => {
    const { familyId, holdId, release } = request.query;
    const challenge = await vault.resolveChallenge(BigInt(familyId), BigInt(holdId), release === "true");
    return json({ challenge });
  },
);

/** Kavya taps "Stop it" or "Allow". Only her passkey can decide. */
app.post("/hold/resolve", async (request) => {
  const body = parse(S.resolveHoldBody, request.body);
  const tx = await vault.resolveHold(body.holdId, body.release, body.auth as never);
  const hold = await vault.readHold(body.holdId);

  void notifyAgent("/hold-resolved", {
    holdId: body.holdId,
    familyId: hold.familyId,
    released: body.release,
    amount: hold.amount,
    to: hold.to,
  });

  return json({
    released: body.release,
    txHash: tx.hash,
    latencyMs: Math.round(tx.latencyMs),
    sync: tx.sync,
    secondsToResolve: Number(BigInt(Math.floor(Date.now() / 1000)) - hold.openedAt),
  });
});

/** Fail-safe. Anyone may call it, and the keeper does so automatically. */
app.post<{ Params: { id: string } }>("/hold/:id/expire", async (request) => {
  const tx = await vault.expireHold(BigInt(request.params.id));
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

// ------------------------------------------------------- check on the child

/** Kavya taps "Check on Arjun" after a suspicious call. */
app.post("/check/request", async (request) => {
  const body = parse(S.requestCheckBody, request.body);
  const { tx, nonce } = await vault.requestCheck(body.familyId);

  void notifyAgent("/check-requested", { familyId: body.familyId, nonce });

  return json({ nonce, txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

app.get<{ Querystring: { familyId: string; nonce: string } }>("/check/challenge", async (request) => {
  const challenge = await vault.livenessChallenge(
    BigInt(request.query.familyId),
    BigInt(request.query.nonce),
  );
  return json({ challenge });
});

/** One tap on the student's own phone. A voice can be cloned; this cannot. */
app.post("/check/prove", async (request) => {
  const body = parse(S.proveLivenessBody, request.body);
  const tx = await vault.proveLiveness(body.familyId, body.nonce, body.auth as never);

  void notifyAgent("/liveness-proved", { familyId: body.familyId, nonce: body.nonce });

  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

// ------------------------------------------------------------------- freeze

/** The duress key freezes outflows. It holds no funds, so it is safe to hand over. */
app.post("/freeze", async (request) => {
  const body = parse(S.freezeBody, request.body);
  // The contract checks the duress signature, so an SOS can only be raised by the student's
  // own device. Nothing below runs unless the freeze really happened.
  // An SOS is the same duress signature as a plain freeze, but it also emits SOSRaised
  // onchain so every one is counted.
  const tx =
    body.kind === "sos"
      ? await vault.sos(body.familyId, body.nonce, body.signature as Hex)
      : await vault.freeze(body.familyId, body.nonce, body.signature as Hex);

  let room: string | undefined;
  if (body.kind === "sos") {
    const record = store.getFamily(String(body.familyId));
    if (record) {
      room = randomBytes(12).toString("hex");
      store.upsertFamily({ ...record, sos: { at: Date.now(), room } });
    }
    // Fire and forget: paging the parent must never make the student wait.
    void notifyAgent("/sos", { familyId: String(body.familyId), room });
  }
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync, room });
});

/**
 * What the scammer is asking for, added by the student after the SOS.
 *
 * Only accepted while an SOS is active and only once, so it cannot be used to spam a
 * parent with pages.
 */
app.post("/sos/detail", async (request, reply) => {
  const body = parse(S.sosDetailBody, request.body);
  const record = store.getFamily(String(body.familyId));
  if (!record?.sos) return reply.code(409).send({ error: "No SOS is active for this family." });
  if (record.sos.demand) return reply.code(409).send({ error: "Already recorded." });
  store.upsertFamily({ ...record, sos: { ...record.sos, demand: body.demand } });
  void notifyAgent("/sos-detail", { familyId: String(body.familyId), demand: body.demand });
  return json({ ok: true });
});

// ------------------------------------------------------------ agent identity

/**
 * The agent's ERC-8004 identity and its public reputation: how many verified saves families have
 * recorded against it. Read from the registries directly. Nothing here names a family or a payee.
 */
/** Monad's per-account reserve is 10 MON; keep a margin above it before sending value out. */
const RESERVE_FLOOR = 11n * 10n ** 18n;

const erc8004 = loadErc8004();

app.get("/agent-identity", async (_request, reply) => {
  if (!erc8004) return reply.code(404).send({ error: "The agent is not registered." });
  const agentId = BigInt(erc8004.agentId);
  const [owner, clients] = await Promise.all([
    chain.publicClient.readContract({ address: erc8004.identityRegistry, abi: IdentityRegistryAbi, functionName: "ownerOf", args: [agentId] }),
    chain.publicClient.readContract({ address: erc8004.reputationRegistry, abi: ReputationRegistryAbi, functionName: "getClients", args: [agentId] }),
  ]);
  let saves = 0n;
  if (clients.length > 0) {
    const [count] = await chain.publicClient.readContract({
      address: erc8004.reputationRegistry,
      abi: ReputationRegistryAbi,
      functionName: "getSummary",
      args: [agentId, [...clients], SAVE_TAG_1, SAVE_TAG_2],
    });
    saves = count;
  }
  return json({
    agentId,
    identityRegistry: erc8004.identityRegistry,
    reputationRegistry: erc8004.reputationRegistry,
    owner,
    verifiedSaves: saves,
    clients: clients.length,
  });
});

/** The family's own account gives the feedback, so it needs a little gas. Sponsored, capped, once per save. */

async function feedbackContext(familyId: bigint, holdId: bigint) {
  if (!erc8004) throw Object.assign(new Error("The agent is not registered."), { statusCode: 404 });
  const [onchain, hold] = await Promise.all([vault.readFamily(familyId).catch(() => null), vault.readHold(holdId).catch(() => null)]);
  if (!onchain || !hold) throw Object.assign(new Error("No such family or hold."), { statusCode: 404 });
  if (hold.familyId !== familyId) throw Object.assign(new Error("That hold is not this family's."), { statusCode: 403 });
  // HOLD_STATUS: 3 = CANCELLED. Only a payment the guardian actually stopped counts as a save.
  if (hold.status !== 3) throw Object.assign(new Error("Only a stopped payment counts as a save."), { statusCode: 409 });
  if (store.feedbackDone(holdId.toString())) throw Object.assign(new Error("This save is already recorded."), { statusCode: 409 });
  const data = saveFeedbackCalldata(BigInt(erc8004.agentId), process.env.APP_URL ?? "");
  return { erc8004, guardianAcct: onchain.guardianAcct as Address, data };
}

app.post("/feedback/prepare", async (request) => {
  const body = parse(S.feedbackPrepareBody, request.body);
  const { erc8004: reg, guardianAcct, data } = await feedbackContext(body.familyId, body.holdId);

  const [nonce, fees, estimated] = await Promise.all([
    chain.publicClient.getTransactionCount({ address: guardianAcct, blockTag: "pending" }),
    chain.publicClient.estimateFeesPerGas(),
    chain.publicClient.estimateGas({ account: guardianAcct, to: reg.reputationRegistry, data }).catch(() => 300_000n),
  ]);
  const gas = (estimated * 12n) / 10n;
  // Monad charges for the gas LIMIT, not the gas used, so the account must hold limit x max fee.
  const needed = gas * fees.maxFeePerGas;
  const balance = await chain.publicClient.getBalance({ address: guardianAcct });
  if (balance < needed * 2n) {
    // Monad keeps a 10 MON reserve on every ordinary account: a transfer that leaves the sender under
    // it reverts (docs.monad.xyz/developer-essentials/reserve-balance). Check before sending value out,
    // and say plainly if the relayer needs topping up, rather than failing mid-rescue.
    const outgoing = needed * 3n - balance;
    const relayerBalance = await chain.publicClient.getBalance({ address: chain.account.address });
    if (relayerBalance - outgoing < RESERVE_FLOOR) {
      throw Object.assign(
        new Error("The relayer is low on MON and cannot sponsor this right now. It must stay above Monad's 10 MON reserve."),
        { statusCode: 503 },
      );
    }
    // Top up to three times what this one call needs, so a retry does not need another top-up.
    const topUp = await chain.send({ to: guardianAcct, data: "0x", value: outgoing, label: "feedbackGas" });
    const after = await chain.publicClient.getBalance({ address: guardianAcct });
    app.log.info(
      { guardianAcct, needed: needed.toString(), before: balance.toString(), after: after.toString(), tx: topUp.hash },
      "topped up a guardian account so it can give feedback",
    );
    // Monad checks a sender's gas budget against its balance from about 3 blocks ago (consensus uses a
    // lagged balance). A top-up that landed a moment ago still looks empty to the network and the
    // transaction would be refused with "insufficient balance". Wait until it is visible at that lag.
    for (let attempt = 0; attempt < 30; attempt++) {
      const head = await chain.publicClient.getBlockNumber();
      const lagged = await chain.publicClient.getBalance({ address: guardianAcct, blockNumber: head - 4n });
      if (lagged >= needed) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return json({
    chainId: chain.chainId,
    to: reg.reputationRegistry,
    data,
    nonce,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
});

/**
 * Broadcasts the guardian's own signed feedback transaction. It is refused unless it is signed by
 * that family's guardian account, goes to the reputation registry, and carries exactly the call the
 * relayer would have built. The relayer therefore cannot be used to send anything else.
 */
app.post("/feedback/submit", async (request) => {
  const body = parse(S.feedbackSubmitBody, request.body);
  const { erc8004: reg, guardianAcct, data } = await feedbackContext(body.familyId, body.holdId);

  let parsed: TransactionSerializable;
  try {
    parsed = parseTransaction(body.rawTx as Hex);
  } catch {
    throw Object.assign(new Error("That is not a valid signed transaction."), { statusCode: 400 });
  }
  const signer = await recoverTransactionAddress({ serializedTransaction: body.rawTx as never });
  if (signer.toLowerCase() !== guardianAcct.toLowerCase()) {
    throw Object.assign(new Error("Only the family's guardian account can give this feedback."), { statusCode: 401 });
  }
  if (parsed.to?.toLowerCase() !== reg.reputationRegistry.toLowerCase() || parsed.data !== data || (parsed.value ?? 0n) !== 0n) {
    throw Object.assign(new Error("That transaction is not the expected feedback call."), { statusCode: 400 });
  }
  const tx = await chain.sendSigned(body.rawTx as Hex, "giveFeedback");
  store.markFeedback(body.holdId.toString());
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

// ------------------------------------------------------ testnet partner stand-in

/**
 * Testnet only: the guardian's own signature deposits stand-in money for her family, playing the
 * part of the licensed remittance partner that would deliver dollars in production.
 *
 * It is authorised by the guardian's `thunai/acct` key, which the contract already knows, so a
 * stranger cannot drain the relayer's float by calling it for someone else's family. Capped per
 * request, replay-proof, and absent unless TESTNET_PARTNER_STANDIN=true.
 */
const usedPartnerDigests = new Set<string>();

function partnerDigest(familyId: bigint, amount: bigint, nonce: bigint, deadline: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      ["thunai.partner.deposit", BigInt(chain.chainId), deployment.thunaiVault as Address, familyId, amount, nonce, deadline],
    ),
  );
}

app.get<{ Querystring: { familyId: string; amount: string } }>("/partner/digest", async (request, reply) => {
  if (!env.TESTNET_PARTNER_STANDIN) return reply.code(404).send({ error: "Not found." });
  const nonce = BigInt(`0x${randomBytes(8).toString("hex")}`);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const digest = partnerDigest(BigInt(request.query.familyId), BigInt(request.query.amount), nonce, deadline);
  return json({ digest, nonce, deadline });
});

app.post("/partner/deposit", async (request, reply) => {
  if (!env.TESTNET_PARTNER_STANDIN) return reply.code(404).send({ error: "Not found." });
  const body = parse(S.partnerDepositBody, request.body);
  const limit = BigInt(Math.round(env.PARTNER_MAX_USD)) * 1_000_000n;
  if (body.amount <= 0n || body.amount > limit) {
    return reply.code(400).send({ error: `A deposit is between $0 and $${env.PARTNER_MAX_USD}.` });
  }
  if (BigInt(Math.floor(Date.now() / 1000)) > body.deadline) {
    return reply.code(400).send({ error: "That deposit request expired. Try again." });
  }

  const digest = partnerDigest(body.familyId, body.amount, body.nonce, body.deadline);
  if (usedPartnerDigests.has(digest)) return reply.code(409).send({ error: "Already used." });

  const onchain = await vault.readFamily(body.familyId).catch(() => null);
  if (!onchain) return reply.code(404).send({ error: "No such family." });
  const signer = await recoverAddress({ hash: digest, signature: body.signature as Hex }).catch(() => null);
  if (!signer || signer.toLowerCase() !== onchain.guardianAcct.toLowerCase()) {
    return reply.code(401).send({ error: "Only the guardian can deposit for this family." });
  }

  usedPartnerDigests.add(digest);
  const tx = await vault.fund(body.familyId, body.amount, true);
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

// ------------------------------------------------------------ encrypted notes

/**
 * A person's encrypted notes. The relayer never sees a key or a plaintext: the key is derived
 * on the person's own devices from their passkey, and the vault stores only ciphertext. Any
 * of their devices can read it back after one Face ID.
 */
app.get<{ Params: { id: string; role: string } }>("/notes/:id/:role", async (request, reply) => {
  const role = Number(request.params.role);
  if (role !== 0 && role !== 1) return reply.code(400).send({ error: "Role must be 0 or 1." });
  const stored = await vault.readNotes(BigInt(request.params.id), role).catch(() => null);
  if (!stored) return reply.code(404).send({ error: "No such family." });
  return json({ ciphertext: stored.ciphertext, version: stored.version });
});

app.get<{ Querystring: { familyId: string; role: string; ciphertext: string } }>(
  "/notes/challenge",
  async (request) => {
    const { familyId, role, ciphertext } = request.query;
    const challenge = await vault.notesChallenge(BigInt(familyId), Number(role), ciphertext as Hex);
    return json({ challenge });
  },
);

app.post("/notes", async (request) => {
  const body = parse(S.notesBody, request.body);
  const tx = await vault.setNotes(body.familyId, body.role, body.ciphertext as Hex, body.auth as never);
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

app.get<{ Querystring: { familyId: string } }>("/freeze/digest", async (request) => {
  const familyId = BigInt(request.query.familyId);
  const [digest, nonce] = await Promise.all([vault.freezeDigest(familyId), vault.freezeNonce(familyId)]);
  return json({ digest, nonce });
});

app.get<{ Querystring: { familyId: string } }>("/unfreeze/challenge", async (request) => {
  const challenge = await vault.unfreezeChallenge(BigInt(request.query.familyId));
  return json({ challenge });
});

app.post("/unfreeze", async (request) => {
  const body = parse(S.unfreezeBody, request.body);
  const tx = await vault.unfreeze(body.familyId, body.auth as never);
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

// ------------------------------------------------------------- the network

app.get<{ Querystring: { familyId: string; handleHash: string; scriptId: string; holdId: string } }>(
  "/report/challenge",
  async (request) => {
    const { familyId, handleHash, scriptId, holdId } = request.query;
    const challenge = await vault.reportChallenge(
      BigInt(familyId),
      handleHash as Hex,
      Number(scriptId),
      BigInt(holdId),
    );
    return json({ challenge });
  },
);

/**
 * A family confirms a scam. Accepted only when that family's guardian cancelled the hold,
 * and only with her passkey, so one report costs one real family's Face ID.
 */
app.post("/report", async (request) => {
  const body = parse(S.reportBody, request.body);
  const tx = await vault.report({
    handleHash: body.handleHash as Hex,
    scriptId: body.scriptId,
    holdId: body.holdId,
    auth: body.auth as never,
  });
  return json({ txHash: tx.hash, latencyMs: Math.round(tx.latencyMs), sync: tx.sync });
});

/** What the hold card shows as evidence: how many families, and how recently. */
app.get<{ Params: { payee: string } }>("/signals/:payee", async (request) => {
  const hash = toHandleHash(request.params.payee as Address);
  const flag = await vault.flagged(hash);
  return json({ handleHash: hash, ...flag });
});

// -------------------------------------------------------------------- push

app.post("/subscribe", async (request, reply) => {
  const body = parse(S.subscribeBody, request.body);
  // Only the student's or the guardian's own account key may subscribe a device for that role.
  // Otherwise anyone who knew a family id could read that family's alerts.
  const onchain = await vault.readFamily(body.familyId).catch(() => null);
  if (!onchain) return reply.code(404).send({ error: "No such family." });
  const expected = body.role === "guardian" ? onchain.guardianAcct : onchain.studentAcct;
  const signer = await recoverAddress({
    hash: subscribeDigest(body.familyId, body.role, body.endpoint),
    signature: body.signature as Hex,
  }).catch(() => null);
  if (!signer || signer.toLowerCase() !== expected.toLowerCase()) {
    return reply.code(401).send({ error: "That device is not signed by this family member." });
  }
  store.subscribe({
    familyId: String(body.familyId),
    role: body.role,
    endpoint: body.endpoint,
    keys: body.keys,
    expoPushToken: body.expoPushToken,
  });
  return { ok: true };
});

/** The agent reads this to know where to page a family. */
app.get<{ Params: { id: string } }>("/subscriptions/:id", async (request, reply) => {
  // Push endpoints are private to the family. Only the agent, which pages them, may list them.
  if (!requireInternal(request, reply)) return;
  return json({ subscriptions: store.subscriptionsFor(request.params.id) });
});

// --------------------------------------------------------------- lifecycle

app.setErrorHandler((error: Error, _request, reply) => {
  const status = (error as { statusCode?: number }).statusCode ?? 500;
  if (status >= 500) app.log.error({ err: error }, "request failed");
  // Revert reasons are the most useful thing a developer can see here, and they carry
  // no secrets: every rule they describe is public in the contract.
  reply.code(status).send({
    error: error.message,
    details: (error as { shortMessage?: string }).shortMessage,
  });
});

const address = await app.listen({ port: env.PORT, host: env.HOST });
app.log.info(
  {
    vault: deployment.thunaiVault,
    scamSignals: deployment.scamSignals,
    relayer: chain.account.address,
    agoraEnabled: deployment.agoraEnabled,
  },
  `Companion relayer on ${address} — pays gas, holds no spending power`,
);
