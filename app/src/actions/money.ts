import { handleHash, toUnits, type ScamScriptId } from "@thunai/shared";
import type { Address } from "viem";
import { api, type DemandKind } from "@/api/client";
import { getDeviceState } from "@/state/store";
import {
  SessionExpiredError,
  signActionHash,
  signDigestWithSession,
  signTransactionWithSession,
  signFreezeWithDuressKey,
} from "@/mera/account";
import { rpId } from "@/config";

/**
 * Money, and the decisions about it.
 *
 * The division of labour here is the whole security model, so it is worth stating once:
 *
 *   - Sending money needs the STUDENT's `thunai/acct` signature. Inside a live signing
 *     session that is silent; the student is spending his own allowance.
 *   - Deciding a held payment needs the GUARDIAN's passkey, as a fresh WebAuthn assertion
 *     verified onchain. It always prompts. A background session must never be able to
 *     release a hold, however recently someone tapped Face ID.
 */

export type SendResult = {
  held: boolean;
  holdId: string;
  reason: number;
  reasonName: string;
  latencyMs: number;
  sync: boolean;
};

/**
 * The student sends money.
 *
 * The memo is required by the UI because it is the single most useful signal the
 * classifier gets, and because a person made to type "immigration bond" sometimes hears
 * themselves say it. Only its hash goes onchain; the text stays between the family's
 * devices and the classifier.
 */
export async function sendMoney(options: {
  familyId: string;
  to: Address;
  amountUsd: number;
  memo: string;
  /** Minutes on a call, if the student chose to share it. */
  callDurationMinutes?: number;
}): Promise<SendResult> {
  const amount = toUnits(options.amountUsd).toString();

  const digest = await api.withdrawDigest({
    familyId: options.familyId,
    to: options.to,
    amount,
    memo: options.memo,
  });

  const signature = await signDigestWithSession(digest.digest);

  return api.withdraw({
    familyId: options.familyId,
    to: options.to,
    amount,
    memo: options.memo,
    nonce: digest.nonce,
    deadline: digest.deadline,
    signature,
    // The student's own clock: a 2am payment is a signal, and the server's timezone is not.
    localHour: new Date().getHours(),
    callDurationMinutes: options.callDurationMinutes,
  });
}

/**
 * The guardian decides: "Stop it" or "Allow".
 *
 * `release: false` returns the money to the student. This is the moment the product
 * exists for, and it is one Face ID.
 */
export async function resolveHold(options: {
  familyId: string;
  holdId: string;
  release: boolean;
}): Promise<{ latencyMs: number; secondsToResolve: number }> {
  const { challenge } = await api.holdChallenge({
    familyId: options.familyId,
    holdId: options.holdId,
    release: options.release,
  });

  // A fresh assertion over this exact decision. The challenge commits to the hold id AND
  // to whether it is a release, so an assertion for "stop" can never be replayed as
  // "allow".
  const auth = await signActionHash({
    rpId: rpId(),
    actionHash: challenge,
    credential: getDeviceState().credential,
  });

  const result = await api.resolveHold({ holdId: options.holdId, release: options.release, auth });
  // A payment the parent stopped is a verified save. Record it against the agent's public reputation,
  // from the family's own account. Best effort and in the background: it must never slow or fail a rescue.
  if (!options.release) void recordVerifiedSave(options.familyId, options.holdId).catch(() => undefined);
  return { latencyMs: result.latencyMs, secondsToResolve: result.secondsToResolve };
}

/** "Check on Arjun". Asks the student's phone to prove it is really in his hands. */
export async function requestCheck(familyId: string): Promise<{ nonce: string; latencyMs: number }> {
  const result = await api.requestCheck(familyId);
  return { nonce: result.nonce, latencyMs: result.latencyMs };
}

/** The student answers the check with one tap. A voice can be cloned; this cannot. */
export async function proveLiveness(options: {
  familyId: string;
  nonce: string;
}): Promise<{ latencyMs: number }> {
  const { challenge } = await api.checkChallenge({
    familyId: options.familyId,
    nonce: options.nonce,
  });

  const auth = await signActionHash({
    rpId: rpId(),
    actionHash: challenge,
    credential: getDeviceState().credential,
  });

  const result = await api.proveLiveness({
    familyId: options.familyId,
    nonce: options.nonce,
    auth,
  });
  return { latencyMs: result.latencyMs };
}

/**
 * Tells other families about a payee.
 *
 * Only possible after the guardian cancelled a hold, and signed with her own passkey, so
 * one report costs one real family's Face ID. A report raises the hold level for everyone
 * else and never blocks a payment by itself.
 */
export async function reportPayee(options: {
  familyId: string;
  holdId: string;
  payee: Address;
  scriptId: ScamScriptId | number;
}): Promise<{ latencyMs: number }> {
  const hash = handleHash(options.payee);

  const { challenge } = await api.reportChallenge({
    familyId: options.familyId,
    handleHash: hash,
    scriptId: options.scriptId,
    holdId: options.holdId,
  });

  const auth = await signActionHash({
    rpId: rpId(),
    actionHash: challenge,
    credential: getDeviceState().credential,
  });

  const result = await api.report({
    familyId: options.familyId,
    handleHash: hash,
    scriptId: options.scriptId,
    holdId: options.holdId,
    auth,
  });
  return { latencyMs: result.latencyMs };
}

/**
 * The duress freeze.
 *
 * Signed by the `thunai/duress` key, which holds no funds and can do nothing except stop
 * everything. That is what makes it safe to use, or to surrender, while someone is
 * watching the screen. Only the guardian's passkey can lift it.
 */
export async function freezeEverything(
  familyId: string,
  kind: "duress" | "sos" = "duress",
): Promise<{ latencyMs: number; room?: string }> {
  const { digest, nonce } = await api.freezeDigest(familyId);
  const signature = await signFreezeWithDuressKey({
    rpId: rpId(),
    digest,
    credential: getDeviceState().credential,
  });
  const result = await api.freeze({ familyId, nonce, signature, kind });
  return { latencyMs: result.latencyMs, room: result.room };
}

export async function unfreeze(familyId: string): Promise<{ latencyMs: number }> {
  const { challenge } = await api.unfreezeChallenge(familyId);
  const auth = await signActionHash({
    rpId: rpId(),
    actionHash: challenge,
    credential: getDeviceState().credential,
  });
  const result = await api.unfreeze({ familyId, auth });
  return { latencyMs: result.latencyMs };
}

/** "Send money now", from the guardian's home screen. */
export async function sendMoneyNow(options: {
  familyId: string;
  amountUsd: number;
}): Promise<{ latencyMs: number }> {
  // Authorised by the guardian's own account key, which the contract already knows. On
  // testnet the relayer plays the licensed remittance partner; nobody else can call this
  // for her family, because only her key signs the digest.
  const amount = toUnits(options.amountUsd).toString();
  const { digest, nonce, deadline } = await api.partnerDigest({ familyId: options.familyId, amount });
  const signature = await signDigestWithSession(digest);
  const result = await api.partnerDeposit({ familyId: options.familyId, amount, nonce, deadline, signature });
  return { latencyMs: result.latencyMs };
}

export { SessionExpiredError };

/** Where the family's video call happens. The room name is random, so only they have it. */
export const videoCallUrl = (room: string) => `https://meet.jit.si/companion-${room}`;

/** Tells the parent what the caller is asking for. Optional, and only after an SOS. */
export async function addSosDetail(familyId: string, demand: DemandKind): Promise<void> {
  await api.sosDetail({ familyId, demand });
}

/**
 * One ERC-8004 reputation entry for the agent: "a verified save happened". It carries no family, no
 * payee, no scam handle and no amount, because the registry is public and permanent. The guardian's
 * own account sends it (the agent's owner never may), and the relayer only tops up gas and broadcasts
 * the exact call it expects.
 */
export async function recordVerifiedSave(familyId: string, holdId: string): Promise<void> {
  const prepared = await api.feedbackPrepare({ familyId, holdId });
  const rawTx = await signTransactionWithSession({
    type: "eip1559",
    chainId: prepared.chainId,
    to: prepared.to,
    data: prepared.data,
    nonce: prepared.nonce,
    gas: BigInt(prepared.gas),
    maxFeePerGas: BigInt(prepared.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(prepared.maxPriorityFeePerGas),
    value: 0n,
  });
  await api.feedbackSubmit({ familyId, holdId, rawTx });
}
