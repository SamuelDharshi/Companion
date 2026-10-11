import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { createChain, loadDeployment, VaultService } from "@thunai/evm";
import {
  HOLD_REASON,
  HOLD_REASON_NAME,
  SCAM_SCRIPT_NAME,
  formatUsd,
  toDollars,
  type Classification,
  type ClassifierInput,
} from "@thunai/shared";
import { loadEnv } from "./env";
import { Classifier } from "./classifier";
import { Keeper } from "./keeper";
import { Pager, type PushTarget } from "./pager";

/**
 * The Companion agent.
 *
 * It runs continuously for every family and does four jobs: run the allowance, read the
 * situation, break the isolation, and fail safe. What it never does is decide. The hold
 * is already open before this service hears about it, and only the guardian's passkey can
 * release it, so every endpoint below is about explaining and connecting.
 */

const env = loadEnv();

const app = Fastify({
  logger: { level: env.LOG_LEVEL, transport: { target: "pino-pretty" } },
});
await app.register(cors, {
  origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
});

const chain = await createChain(
  { rpcUrl: env.MONAD_RPC_URL, privateKey: env.AGENT_PRIVATE_KEY },
  app.log,
);
const deployment = loadDeployment(
  { thunaiVault: env.THUNAI_VAULT_ADDRESS, scamSignals: env.SCAM_SIGNALS_ADDRESS },
  chain.chainId,
);
const vault = new VaultService(chain, deployment);

const classifier = new Classifier({
  apiKey: env.ANTHROPIC_API_KEY,
  model: env.CLASSIFIER_MODEL,
  effort: env.CLASSIFIER_EFFORT,
  timeoutMs: env.CLASSIFIER_TIMEOUT_MS,
});

const pager = new Pager({
  vapidPublicKey: env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: env.VAPID_PRIVATE_KEY,
  vapidSubject: env.VAPID_SUBJECT,
  expoPushUrl: env.EXPO_PUSH_URL,
  appUrl: env.APP_URL,
  log: app.log,
});

function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

/**
 * Everything the agent knows about a hold, kept in memory.
 *
 * Deliberately not persisted: it is all derivable from chain plus a re-classification,
 * and persisting a memo would put the student's own words on a server. Chain is the
 * record; this is a cache in front of it.
 */
type HoldBrief = {
  holdId: string;
  familyId: string;
  amount: bigint;
  payeeName?: string;
  memo: string;
  reason: number;
  classification: Classification;
  classifierSource: "model" | "rules";
  openedAt: number;
  pagedDevices: number;
  whatsAppLink: string;
  /** Minutes on a call, when the student chose to share it. */
  callDurationMinutes?: number;
  alert: ReturnType<Pager["buildAlert"]>;
};

const briefs = new Map<string, HoldBrief>();

/** Family display names and push targets live on the relayer; the agent borrows them. */
async function relayer<T>(path: string): Promise<T | undefined> {
  try {
    const response = await fetch(`${env.RELAYER_URL}${path}`, {
      headers: { "x-internal-token": env.INTERNAL_TOKEN ?? "" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- access control

function sameSecret(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The agent is reachable from the internet through the same tunnel as the app, so every route
 * that changes anything or costs money checks who is calling.
 *
 *   webhooks (/hold-opened, /sos, ...)  only the relayer, with INTERNAL_TOKEN. Fails closed.
 *   dev endpoints (/classify, /keeper/tick)  need DEV_ADMIN_TOKEN, and do not exist without it.
 *   read-only routes (/health, /brief/:id)  open, because the app reads them.
 */
const INTERNAL_PATHS = new Set([
  "/hold-opened",
  "/hold-resolved",
  "/check-requested",
  "/liveness-proved",
  "/sos",
  "/sos-detail",
]);
const ADMIN_PATHS = new Set(["/classify", "/keeper/tick"]);

app.addHook("onRequest", async (request, reply) => {
  const path = request.url.split("?")[0] ?? "";
  if (ADMIN_PATHS.has(path)) {
    if (!env.DEV_ADMIN_TOKEN) return reply.code(404).send({ error: "Not found." });
    if (!sameSecret(request.headers["x-admin-token"], env.DEV_ADMIN_TOKEN)) {
      return reply.code(401).send({ error: "Admin token required." });
    }
  } else if (INTERNAL_PATHS.has(path)) {
    if (!sameSecret(request.headers["x-internal-token"], env.INTERNAL_TOKEN)) {
      return reply.code(env.INTERNAL_TOKEN ? 401 : 503).send({ error: "Internal endpoint." });
    }
  }
});

// ------------------------------------------------------------------- hooks

const holdOpenedBody = z.object({
  familyId: z.union([z.string(), z.number()]),
  holdId: z.union([z.string(), z.number()]),
  to: z.string(),
  payeeName: z.string().optional(),
  amount: z.union([z.string(), z.number()]),
  memo: z.string().default(""),
  reason: z.number().int(),
  reasonName: z.string().optional(),
  localHour: z.number().int().min(0).max(23).optional(),
  callDurationMinutes: z.number().int().optional(),
  networkFlagCount: z.number().int().default(0),
});

/**
 * The relayer calls this the instant a hold opens.
 *
 * Order matters: classify, then page. The classification is what makes the alert
 * actionable ("this looks like the fake officer scam") rather than merely alarming, and
 * the classifier is capped at a few seconds with a deterministic fallback, so the page is
 * never delayed for long. The student's screen already says "Held for safety" before this
 * route is even called.
 */
app.post("/hold-opened", async (request) => {
  const parsed = holdOpenedBody.safeParse(request.body);
  if (!parsed.success) {
    app.log.warn({ issues: parsed.error.issues }, "bad /hold-opened payload");
    return { ok: false };
  }
  const body = parsed.data;
  const familyId = String(body.familyId);
  const holdId = String(body.holdId);
  const amount = BigInt(body.amount);

  const family = await relayer<{ studentName?: string; env?: { weeklyAmount?: string } }>(
    `/family/${familyId}`,
  );
  const studentName = family?.studentName ?? "Your child";
  const weekly = Number(family?.env?.weeklyAmount ?? 0);
  const amountUsd = toDollars(amount);

  const input: ClassifierInput = {
    memo: body.memo,
    amountUsd,
    // A multiple of the family's own normal, which is far more telling than a flat amount.
    amountVsUsual: weekly > 0 ? amountUsd / toDollars(BigInt(Math.round(weekly))) : 1,
    payeeIsNew: body.reason === HOLD_REASON.NEW_PAYEE || body.reason === HOLD_REASON.NETWORK_FLAG,
    localHour: body.localHour ?? new Date().getUTCHours(),
    networkFlagCount: body.networkFlagCount,
    callDurationMinutes: body.callDurationMinutes,
  };

  const classification = await classifier.classify(input);
  const alert = pager.buildAlert({
    familyId,
    holdId,
    amount,
    payeeName: body.payeeName,
    reason: body.reason,
    classification,
    studentName,
    callDurationMinutes: body.callDurationMinutes,
  });

  const subs = await relayer<{ subscriptions: PushTarget[] }>(`/subscriptions/${familyId}`);
  const guardians = (subs?.subscriptions ?? []).filter((s) => s.role === "guardian");
  const pagedDevices = guardians.length > 0 ? await pager.page(guardians, alert) : 0;

  const brief: HoldBrief = {
    holdId,
    familyId,
    amount,
    payeeName: body.payeeName,
    memo: body.memo,
    reason: body.reason,
    classification,
    classifierSource: classification.source,
    openedAt: Date.now(),
    pagedDevices,
    whatsAppLink: pager.whatsAppLink(alert),
    callDurationMinutes: body.callDurationMinutes,
    alert,
  };
  briefs.set(holdId, brief);

  app.log.info(
    {
      holdId,
      familyId,
      amount: formatUsd(amount),
      reason: HOLD_REASON_NAME[body.reason],
      script: SCAM_SCRIPT_NAME[classification.scriptId],
      confidence: classification.confidence,
      source: classification.source,
      pagedDevices,
    },
    "hold classified and guardian paged",
  );

  return json({ ok: true, classification, alert, pagedDevices, whatsAppLink: brief.whatsAppLink });
});

/** What the guardian's alert screen and the student's hold screen both read. */
app.get<{ Params: { id: string } }>("/brief/:id", async (request, reply) => {
  const brief = briefs.get(request.params.id);
  if (!brief) {
    // A restart loses the cache; the hold itself is still on chain and still safe.
    return reply.code(404).send({ error: "No briefing for this hold yet." });
  }
  return json(brief);
});

app.post("/hold-resolved", async (request) => {
  const body = request.body as { holdId?: string | number; released?: boolean };
  const holdId = String(body.holdId ?? "");
  briefs.delete(holdId);
  app.log.info({ holdId, released: body.released }, "hold resolved by the guardian");
  return { ok: true };
});

/**
 * Kavya tapped "Check on Arjun".
 *
 * The student is paged to tap once. Until they do, the contract holds any payment from
 * the guardian to a new payee, so a cloned voice cannot talk her into sending money
 * while the real child is unreachable.
 */
app.post("/check-requested", async (request) => {
  const body = request.body as { familyId?: string | number; nonce?: string | number };
  const familyId = String(body.familyId ?? "");

  const subs = await relayer<{ subscriptions: PushTarget[] }>(`/subscriptions/${familyId}`);
  const students = (subs?.subscriptions ?? []).filter((s) => s.role === "student");
  if (students.length > 0) {
    await pager.page(students, {
      title: "Kavya is checking on you",
      titleTa: "அம்மா உங்களை சரிபார்க்கிறார்",
      body: "Tap Face ID to show it's really you.",
      bodyTa: "நீங்கள்தான் என்று காட்ட Face ID தொடவும்.",
      url: `${env.APP_URL}/check/${body.nonce ?? ""}`,
      amount: "",
      holdId: "",
      familyId,
      scriptId: 0,
      footer: "",
    });
  }
  app.log.info({ familyId, nonce: String(body.nonce) }, "liveness check requested");
  return { ok: true, pagedDevices: students.length };
});

const DEMAND_LABEL: Record<string, string> = {
  gift_card: "gift cards",
  zelle: "a Zelle or bank transfer",
  wire: "a wire transfer",
  crypto: "crypto, such as a Bitcoin ATM",
  other: "money, some other way",
};

type FamilyNames = { studentName?: string; guardianName?: string };

/** The page a parent gets when the student quietly raises the alarm. */
function sosAlert(familyId: string, studentName: string, time: string, room?: string, demand?: string) {
  const ask = demand ? ` They are asking for ${DEMAND_LABEL[demand] ?? "money"}.` : "";
  const call = room ? ` Video call: https://meet.jit.si/companion-${room}` : "";
  return {
    title: `${studentName} pressed SOS`,
    titleTa: "",
    body:
      `Someone is demanding money from ${studentName}. He may be on a call right now (${time}).` +
      `${ask} His money in the app is paused.${call}`,
    bodyTa: "",
    url: `${env.APP_URL}/guardian/frozen`,
    amount: "",
    holdId: "",
    familyId,
    scriptId: 0,
    footer: "Call him now. Real officers never ask for payment by phone, gift card or crypto.",
  };
}

/**
 * The student pressed Silent SOS.
 *
 * The relayer has already frozen the family onchain, because it only calls this after the
 * freeze succeeded. This breaks the isolation the scam depends on, whatever way the
 * scammer wants to be paid: gift card, Zelle, wire or crypto. It pages every guardian
 * device at once, and always builds the WhatsApp message as the backstop channel.
 */
app.post("/sos", async (request) => {
  const body = request.body as { familyId?: string | number; room?: string };
  const familyId = String(body.familyId ?? "");
  const names = await relayer<FamilyNames>(`/family/${familyId}`);
  const studentName = names?.studentName ?? "Your child";
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const alert = sosAlert(familyId, studentName, time, body.room);
  const subs = await relayer<{ subscriptions: PushTarget[] }>(`/subscriptions/${familyId}`);
  const guardians = (subs?.subscriptions ?? []).filter((s) => s.role === "guardian");
  const pagedDevices = guardians.length > 0 ? await pager.page(guardians, alert) : 0;

  app.log.warn({ familyId, pagedDevices }, "SOS: the student says someone is demanding money");
  return { ok: true, pagedDevices, whatsAppLink: pager.whatsAppLink(alert) };
});

/** The student said what the caller wants. One short follow-up page. */
app.post("/sos-detail", async (request) => {
  const body = request.body as { familyId?: string | number; demand?: string };
  const familyId = String(body.familyId ?? "");
  const names = await relayer<FamilyNames>(`/family/${familyId}`);
  const studentName = names?.studentName ?? "Your child";
  const alert = {
    ...sosAlert(familyId, studentName, "", undefined, body.demand),
    title: `${studentName} says they want ${DEMAND_LABEL[body.demand ?? "other"] ?? "money"}`,
    body: `${studentName} says the person is asking for ${DEMAND_LABEL[body.demand ?? "other"] ?? "money"}. His money in the app is paused.`,
  };
  const subs = await relayer<{ subscriptions: PushTarget[] }>(`/subscriptions/${familyId}`);
  const guardians = (subs?.subscriptions ?? []).filter((s) => s.role === "guardian");
  const pagedDevices = guardians.length > 0 ? await pager.page(guardians, alert) : 0;
  return { ok: true, pagedDevices };
});

app.post("/liveness-proved", async (request) => {
  const body = request.body as { familyId?: string | number };
  app.log.info({ familyId: String(body.familyId) }, "liveness proved on the student's own phone");
  return { ok: true };
});

/** Lets the app preview a classification without any money involved (used in the drill). */
app.post("/classify", async (request) => {
  const input = request.body as ClassifierInput;
  const classification = await classifier.classify({
    memo: input.memo ?? "",
    amountUsd: input.amountUsd ?? 0,
    amountVsUsual: input.amountVsUsual ?? 1,
    payeeIsNew: input.payeeIsNew ?? true,
    localHour: input.localHour ?? new Date().getUTCHours(),
    networkFlagCount: input.networkFlagCount ?? 0,
    callDurationMinutes: input.callDurationMinutes,
  });
  return json({ classification, scriptName: SCAM_SCRIPT_NAME[classification.scriptId] });
});

// ------------------------------------------------------------------ keeper

const keeper = new Keeper({
  vault,
  intervalMs: env.KEEPER_INTERVAL_MS,
  log: app.log,
  onHoldExpired: (holdId) => briefs.delete(String(holdId)),
});

app.get("/health", async () => ({
  ok: true,
  uptime: process.uptime(),
  classifier: classifier.enabled ? env.CLASSIFIER_MODEL : "deterministic rules (no API key)",
  keeper: keeper.status(),
  agentAddress: chain.account.address,
  vault: deployment.thunaiVault,
}));

/** Lets the demo force a sweep instead of waiting for the next minute. */
app.post("/keeper/tick", async () => {
  await keeper.tick();
  return json(keeper.status());
});

const address = await app.listen({ port: env.AGENT_PORT, host: env.HOST });
if (env.KEEPER_ENABLED) keeper.start();

app.log.info(
  {
    vault: deployment.thunaiVault,
    agent: chain.account.address,
    classifier: classifier.enabled ? env.CLASSIFIER_MODEL : "rules",
    keeper: env.KEEPER_ENABLED,
  },
  `Companion agent on ${address} — rules decide, the agent explains`,
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    keeper.stop();
    await app.close();
    process.exit(0);
  });
}
