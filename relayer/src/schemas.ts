import { z } from "zod";

/**
 * Request validation.
 *
 * Everything crossing this boundary is untrusted: a request may come from a device the
 * family lost, or from someone who guessed a family id. The relayer is not the security
 * boundary (the contract is), but rejecting malformed input here keeps the failure in a
 * readable 400 instead of an opaque revert mid-demo.
 */

export const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected 32-byte hex");
export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected an address");
export const bytesHex = z.string().regex(/^0x[0-9a-fA-F]*$/, "expected hex bytes");
const bigintish = z.union([z.string(), z.number()]).transform((v) => BigInt(v));

/** A WebAuthn assertion, shaped for Solady's `WebAuthn.WebAuthnAuth`. */
export const webAuthnAuth = z.object({
  authenticatorData: bytesHex,
  clientDataJSON: z.string().min(1),
  challengeIndex: bigintish,
  typeIndex: bigintish,
  r: hex32,
  s: hex32,
});

export const passkeyPublicKey = z.object({ x: hex32, y: hex32 });

/** Step one: the student creates a passkey. Nothing touches the chain yet. */
export const onboardStudentBody = z.object({
  studentPasskey: passkeyPublicKey,
  studentAcct: address,
  /** The student's own duress key, registered later as the freeze authority. */
  duressAddr: address,
  studentName: z.string().min(1).max(60).default("Student"),
});

/** Step two: the guardian accepts, and only now is the family registered onchain. */
export const onboardGuardianBody = z.object({
  inviteCode: z.string().min(4).max(64),
  guardianPasskey: passkeyPublicKey,
  guardianAcct: address,
  guardianName: z.string().min(1).max(60).default("Guardian"),
});

export const envelopeStruct = z.object({
  weeklyAmount: bigintish,
  perWithdrawalCap: bigintish,
  payeesRoot: hex32,
  cadence: bigintish,
  holdTimeout: bigintish,
  expiry: bigintish,
  nextRunAt: bigintish,
});

export const envelopeChallengeBody = z.object({
  familyId: bigintish,
  envelope: envelopeStruct,
});

export const setEnvelopeBody = z.object({
  familyId: bigintish,
  envelope: envelopeStruct,
  auth: webAuthnAuth,
});

export const withdrawBody = z.object({
  familyId: bigintish,
  to: address,
  amount: bigintish,
  /** Free text: "What's this for?". Only its hash goes onchain. */
  memo: z.string().max(500).default(""),
  nonce: bigintish,
  deadline: bigintish,
  signature: bytesHex,
  /** The student's local hour, for the classifier. */
  localHour: z.number().int().min(0).max(23).optional(),
  /** Minutes on a call, if the student chose to say. */
  callDurationMinutes: z.number().int().min(0).max(1440).optional(),
});

export const resolveHoldBody = z.object({
  holdId: bigintish,
  release: z.boolean(),
  auth: webAuthnAuth,
});

export const requestCheckBody = z.object({ familyId: bigintish });

export const proveLivenessBody = z.object({
  familyId: bigintish,
  nonce: bigintish,
  auth: webAuthnAuth,
});

export const demandKind = z.enum(["gift_card", "zelle", "wire", "crypto", "other"]);

/** A guardian-signed deposit from the testnet stand-in for the licensed remittance partner. */
export const partnerDepositBody = z.object({
  familyId: bigintish,
  amount: bigintish,
  nonce: bigintish,
  deadline: bigintish,
  signature: bytesHex,
});

export const feedbackPrepareBody = z.object({ familyId: bigintish, holdId: bigintish });
export const feedbackSubmitBody = z.object({ familyId: bigintish, holdId: bigintish, rawTx: bytesHex });

export const freezeBody = z.object({
  familyId: bigintish,
  nonce: bigintish,
  signature: bytesHex,
  /** "sos" is the student's Silent SOS; anything else is the quiet duress freeze. */
  kind: z.enum(["duress", "sos"]).optional(),
});

/** What the caller is asking for. Added after the SOS, never required for it. */
export const sosDetailBody = z.object({ familyId: bigintish, demand: demandKind });

export const unfreezeBody = z.object({ familyId: bigintish, auth: webAuthnAuth });

/** A person's encrypted notes, authorised by their own passkey. Ciphertext only. */
export const notesBody = z.object({
  familyId: bigintish,
  role: z.union([z.literal(0), z.literal(1)]),
  ciphertext: bytesHex,
  auth: webAuthnAuth,
});

export const reportBody = z.object({
  familyId: bigintish,
  handleHash: hex32,
  scriptId: z.number().int().min(0).max(5),
  holdId: bigintish,
  auth: webAuthnAuth,
});

export const addPayeeBody = z.object({
  familyId: bigintish,
  address,
  name: z.string().min(1).max(60),
  scheduled: z.boolean().default(true),
});

export const subscribeBody = z.object({
  familyId: bigintish,
  role: z.enum(["student", "guardian"]),
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string(), auth: z.string() }).optional(),
  expoPushToken: z.string().optional(),
  /** The person's `thunai/acct` signature over `subscribeDigest`. Proves the device is theirs. */
  signature: bytesHex,
});

export const fundBody = z.object({
  familyId: bigintish,
  amount: bigintish,
  /** Settle in the same transaction, so the student sees it arrive at once. */
  settle: z.boolean().default(true),
});
