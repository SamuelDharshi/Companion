import Constants from "expo-constants";
import { recordLatency } from "@/latency";
import type { Address, Hex } from "viem";
import type { Classification, WebAuthnAuth } from "@thunai/shared";

/**
 * The relayer and agent clients.
 *
 * Everything that costs gas goes through the relayer, which sponsors it. Nothing here
 * carries authority: a withdraw is already signed by the student before it is posted, and
 * a hold decision already carries the guardian's assertion. If this client were replaced
 * by a hostile one, it could waste the relayer's gas and nothing else.
 */

type Extra = { relayerUrl?: string; agentUrl?: string; indexerUrl?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Overridable at runtime so a judge can point the app at a hosted backend. */
export const endpoints = {
  relayer: process.env.EXPO_PUBLIC_RELAYER_URL ?? extra.relayerUrl ?? "http://localhost:8787",
  agent: process.env.EXPO_PUBLIC_AGENT_URL ?? extra.agentUrl ?? "http://localhost:8788",
  indexer:
    process.env.EXPO_PUBLIC_INDEXER_URL ?? extra.indexerUrl ?? "http://localhost:8080/v1/graphql",
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The hosted server runs on a free plan that sleeps when idle and takes up to a minute to wake. While it wakes, the site
 * answers 502/503/504 (our own launcher says {"error":"starting"}), so those are retried for about a minute instead of showing
 * a parent an error. A plain network failure is retried only for reads: a write that may have reached the server is never sent
 * twice.
 */
async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const isRead = !init?.method || init.method === "GET";
  const deadline = Date.now() + 70_000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce<T>(base, path, init);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : -1;
      const waking = status === 502 || status === 504 || (status === 503 && error instanceof ApiError && error.message === "starting");
      const retry = waking || (status === 0 && isRead);
      if (!retry || Date.now() > deadline) throw error;
      await new Promise((r) => setTimeout(r, Math.min(2_000 + attempt * 1_000, 6_000)));
    }
  }
}

async function requestOnce<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        // Harmless anywhere else; stops ngrok's free tier answering API calls with its
        // "Visit Site" warning page when the backend is reached through a tunnel.
        "ngrok-skip-browser-warning": "true",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // A network failure here is the most likely thing to go wrong in a live demo, so the
    // message says what to check rather than leaking a stack trace to a parent.
    throw new ApiError(
      `Cannot reach Companion's server at ${base}. Check it is running and reachable from this device.`,
      0,
    );
  }

  const text = await response.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text };
  }
  if (response.ok && typeof body?.latencyMs === "number") recordLatency(path, body.latencyMs);
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status);
  }
  return body as T;
}

const relayerGet = <T>(path: string) => request<T>(endpoints.relayer, path);
const relayerPost = <T>(path: string, payload?: unknown) =>
  request<T>(endpoints.relayer, path, { method: "POST", body: JSON.stringify(payload ?? {}) });

// -------------------------------------------------------------- types

export type Config = {
  chainId: number;
  thunaiVault: Address;
  scamSignals: Address;
  ctk: Address;
  ausd: Address;
  agoraPair: Address;
  agoraEnabled: boolean;
  standInTokens: boolean;
  relayerAddress: Address;
  syncSendSupported: boolean | null;
  vapidPublicKey: string | null;
  familyCount: string;
};

export type TxResult = { txHash: Hex; latencyMs: number; sync: boolean };

export type DemandKind = "gift_card" | "zelle" | "wire" | "crypto" | "other";

export type FamilyState = {
  familyId: string;
  studentAcct: Address;
  guardianAcct: Address;
  duressAddr: Address;
  balance: string;
  homeBalance: string;
  balanceLabel: string;
  homeBalanceLabel: string;
  frozen: boolean;
  checkNonce: string;
  checkRequestedAt: string;
  env: {
    weeklyAmount: string;
    perWithdrawalCap: string;
    payeesRoot: Hex;
    cadence: string;
    holdTimeout: string;
    expiry: string;
    nextRunAt: string;
  };
  studentName: string;
  guardianName: string;
  payees: { address: Address; name: string; scheduled: boolean; contact?: string }[];
  inviteCode?: string;
  inviteAccepted: boolean;
  allowanceDue: boolean;
  /** Set while the student's Silent SOS is active. The room is an unguessable video-call name. */
  sos?: { at: number; room: string; demand?: string };
  /** Hold ids still awaiting a guardian decision, newest first. Read from the contract. */
  openHolds: string[];
};

export type HoldState = {
  holdId: string;
  familyId: string;
  to: Address;
  amount: string;
  amountLabel: string;
  reason: number;
  reasonName: string;
  status: number;
  statusName: string;
  openedAt: string;
  releaseAt: string;
  memoHash: Hex;
  payeeName?: string;
  /** The contact the student typed, masked: "+91 ••••• 3210". */
  payeeContact?: string;
  networkFlagCount: number;
  networkLastAt: number;
};

export type HoldBrief = {
  holdId: string;
  familyId: string;
  amount: string;
  payeeName?: string;
  memo: string;
  reason: number;
  classification: Classification & { source?: "model" | "rules" };
  classifierSource: "model" | "rules";
  openedAt: number;
  pagedDevices: number;
  whatsAppLink: string;
  /** Minutes the student said they had been on a call, when they shared it. */
  callDurationMinutes?: number;
  alert: {
    title: string;
    titleTa: string;
    body: string;
    bodyTa: string;
    url: string;
    footer: string;
  };
};

// ---------------------------------------------------------------- api

export const api = {
  config: () => relayerGet<Config>("/config"),

  // onboarding: two steps, because nothing is registered onchain until both passkeys
  // are real ones.
  onboardStudent: (payload: {
    studentPasskey: { x: Hex; y: Hex };
    studentAcct: Address;
    duressAddr: Address;
    studentName: string;
  }) => relayerPost<{ inviteCode: string }>("/onboard/student", payload),

  onboardGuardian: (payload: {
    inviteCode: string;
    guardianPasskey: { x: Hex; y: Hex };
    guardianAcct: Address;
    guardianName: string;
  }) =>
    relayerPost<{ familyId: string; studentName: string } & TxResult>(
      "/onboard/guardian",
      payload,
    ),

  invite: (code: string) =>
    relayerGet<{
      familyId: string | null;
      studentName: string;
      guardianName: string | null;
      accepted: boolean;
    }>(`/invite/${code}`),

  envelopeChallenge: (payload: { familyId: string; envelope: Record<string, string> }) =>
    relayerPost<{ challenge: Hex }>("/family/envelope-challenge", payload),

  setEnvelope: (payload: {
    familyId: string;
    envelope: Record<string, string>;
    auth: WebAuthnAuth;
  }) => relayerPost<TxResult>("/family/envelope", serializeAuth(payload)),

  agentIdentity: () =>
    relayerGet<{
      agentId: string;
      identityRegistry: Address;
      reputationRegistry: Address;
      owner: Address;
      verifiedSaves: string;
      clients: number;
    }>("/agent-identity"),
  feedbackPrepare: (payload: { familyId: string; holdId: string }) =>
    relayerPost<{
      chainId: number;
      to: Address;
      data: Hex;
      nonce: number;
      gas: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    }>("/feedback/prepare", payload),
  feedbackSubmit: (payload: { familyId: string; holdId: string; rawTx: Hex }) =>
    relayerPost<TxResult>("/feedback/submit", payload),
  stats: () => relayerGet<Record<string, string | number> & { families: string; holdsOpened: string; sosRaised: string }>("/stats"),

  // encrypted notes: ciphertext only. The key is derived on the device from the passkey.
  notes: (familyId: string, role: 0 | 1) =>
    relayerGet<{ ciphertext: Hex; version: string }>(`/notes/${familyId}/${role}`),
  notesChallenge: (p: { familyId: string; role: 0 | 1; ciphertext: Hex }) =>
    relayerGet<{ challenge: Hex }>(
      `/notes/challenge?familyId=${p.familyId}&role=${p.role}&ciphertext=${p.ciphertext}`,
    ),
  setNotes: (p: { familyId: string; role: 0 | 1; ciphertext: Hex; auth: WebAuthnAuth }) =>
    relayerPost<TxResult>("/notes", serializeAuth(p)),

  family: (familyId: string) => relayerGet<FamilyState>(`/family/${familyId}`),
  familyByAccount: (address: Address) =>
    relayerGet<{ familyId: string | null; role: "student" | "guardian" | null }>(
      `/family/by-account/${address}`,
    ),

  // payees
  addPayee: (payload: { familyId: string; address: Address; name: string; scheduled: boolean }) =>
    relayerPost<{ payeesRoot: Hex; payees: FamilyState["payees"] }>("/payees", payload),
  /** Turns a name and a phone number or email into the person to pay. No address is ever typed or shown. */
  resolvePayee: (payload: { familyId: string; name: string; contact: string }) =>
    relayerPost<{ address: Address; name: string; contact: string; kind: "phone" | "email"; scheduled: boolean }>(
      "/payee/resolve",
      payload,
    ),
  payees: (familyId: string) =>
    relayerGet<{ payeesRoot: Hex; payees: FamilyState["payees"] }>(`/payees/${familyId}`),

  // sending
  withdrawDigest: (params: { familyId: string; to: Address; amount: string; memo: string }) =>
    relayerGet<{ digest: Hex; nonce: string; deadline: string; memoHash: Hex }>(
      `/withdraw/digest?familyId=${params.familyId}&to=${params.to}&amount=${params.amount}&memo=${encodeURIComponent(params.memo)}`,
    ),
  withdraw: (payload: {
    familyId: string;
    to: Address;
    amount: string;
    memo: string;
    nonce: string;
    deadline: string;
    signature: Hex;
    localHour?: number;
    callDurationMinutes?: number;
  }) =>
    relayerPost<{ held: boolean; holdId: string; reason: number; reasonName: string } & TxResult>(
      "/withdraw",
      payload,
    ),

  // holds
  hold: (holdId: string) => relayerGet<HoldState>(`/hold/${holdId}`),
  holdChallenge: (params: { familyId: string; holdId: string; release: boolean }) =>
    relayerGet<{ challenge: Hex }>(
      `/hold/challenge?familyId=${params.familyId}&holdId=${params.holdId}&release=${params.release}`,
    ),
  resolveHold: (payload: { holdId: string; release: boolean; auth: WebAuthnAuth }) =>
    relayerPost<{ released: boolean; secondsToResolve: number } & TxResult>(
      "/hold/resolve",
      serializeAuth(payload),
    ),

  // check on the student
  requestCheck: (familyId: string) =>
    relayerPost<{ nonce: string } & TxResult>("/check/request", { familyId }),
  checkChallenge: (params: { familyId: string; nonce: string }) =>
    relayerGet<{ challenge: Hex }>(
      `/check/challenge?familyId=${params.familyId}&nonce=${params.nonce}`,
    ),
  proveLiveness: (payload: { familyId: string; nonce: string; auth: WebAuthnAuth }) =>
    relayerPost<TxResult>("/check/prove", serializeAuth(payload)),

  // freeze
  freezeDigest: (familyId: string) =>
    relayerGet<{ digest: Hex; nonce: string }>(`/freeze/digest?familyId=${familyId}`),
  freeze: (payload: { familyId: string; nonce: string; signature: Hex; kind?: "duress" | "sos" }) =>
    relayerPost<TxResult & { room?: string }>("/freeze", payload),
  sosDetail: (payload: { familyId: string; demand: DemandKind }) =>
    relayerPost<{ ok: boolean }>("/sos/detail", payload),
  unfreezeChallenge: (familyId: string) =>
    relayerGet<{ challenge: Hex }>(`/unfreeze/challenge?familyId=${familyId}`),
  unfreeze: (payload: { familyId: string; auth: WebAuthnAuth }) =>
    relayerPost<TxResult>("/unfreeze", serializeAuth(payload)),

  // the network
  reportChallenge: (params: {
    familyId: string;
    handleHash: Hex;
    scriptId: number;
    holdId: string;
  }) =>
    relayerGet<{ challenge: Hex }>(
      `/report/challenge?familyId=${params.familyId}&handleHash=${params.handleHash}&scriptId=${params.scriptId}&holdId=${params.holdId}`,
    ),
  report: (payload: {
    familyId: string;
    handleHash: Hex;
    scriptId: number;
    holdId: string;
    auth: WebAuthnAuth;
  }) => relayerPost<TxResult>("/report", serializeAuth(payload)),
  signals: (payee: Address) =>
    relayerGet<{ handleHash: Hex; count: number; lastAt: number }>(`/signals/${payee}`),

  // funding: the guardian's own signature, playing the licensed partner on testnet
  partnerDigest: (params: { familyId: string; amount: string }) =>
    relayerGet<{ digest: Hex; nonce: string; deadline: string }>(
      `/partner/digest?familyId=${params.familyId}&amount=${params.amount}`,
    ),
  partnerDeposit: (payload: {
    familyId: string;
    amount: string;
    nonce: string;
    deadline: string;
    signature: Hex;
  }) => relayerPost<TxResult>("/partner/deposit", payload),

  // push
  subscribe: (payload: {
    familyId: string;
    role: "student" | "guardian";
    endpoint: string;
    keys?: { p256dh: string; auth: string };
    expoPushToken?: string;
    signature: Hex;
  }) => relayerPost<{ ok: boolean }>("/subscribe", payload),

  // the agent
  brief: (holdId: string) => request<HoldBrief>(endpoints.agent, `/brief/${holdId}`),
  agentHealth: () =>
    request<{ ok: boolean; classifier: string; keeper: unknown }>(endpoints.agent, "/health"),
};

/**
 * bigint-safe JSON for an assertion.
 *
 * `challengeIndex` and `typeIndex` are bigints so they can go straight into viem's ABI
 * encoder, but JSON.stringify throws on them. The relayer coerces them back, so strings
 * on the wire are exactly what it expects.
 */
function serializeAuth<T extends { auth: WebAuthnAuth }>(payload: T): T {
  return {
    ...payload,
    auth: {
      ...payload.auth,
      challengeIndex: payload.auth.challengeIndex.toString() as unknown as bigint,
      typeIndex: payload.auth.typeIndex.toString() as unknown as bigint,
    },
  };
}
