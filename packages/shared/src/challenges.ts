import { encodeAbiParameters, encodePacked, keccak256, toHex, type Address, type Hex } from "viem";

/**
 * Action hashes: the exact 32 bytes a passkey signs.
 *
 * Every challenge is bound to the chain, the vault, the family and the action, so an
 * assertion captured for one approval can never be replayed for another, on another
 * family, or on another network. The contract exposes matching `*Challenge` views, and
 * the app prefers those; these helpers exist so the relayer and the agent can compute
 * and check a challenge without a round-trip.
 */

export const ACTION_KIND = {
  envelope: keccak256(toHex("thunai.envelope")),
  resolveHold: keccak256(toHex("thunai.resolveHold")),
  proveLiveness: keccak256(toHex("thunai.proveLiveness")),
  unfreeze: keccak256(toHex("thunai.unfreeze")),
  freeze: keccak256(toHex("thunai.freeze")),
  notes: keccak256(toHex("thunai.notes")),
  report: keccak256(toHex("thunai.report")),
} as const;

function actionHash(
  chainId: number,
  contract: Address,
  familyId: bigint,
  kind: Hex,
  payload: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bytes32" }],
      [BigInt(chainId), contract, familyId, kind, payload],
    ),
  );
}

export type EnvelopeStruct = {
  weeklyAmount: bigint;
  perWithdrawalCap: bigint;
  payeesRoot: Hex;
  cadence: bigint;
  holdTimeout: bigint;
  expiry: bigint;
  nextRunAt: bigint;
};

const ENVELOPE_ABI = [
  {
    type: "tuple",
    components: [
      { name: "weeklyAmount", type: "uint128" },
      { name: "perWithdrawalCap", type: "uint128" },
      { name: "payeesRoot", type: "bytes32" },
      { name: "cadence", type: "uint64" },
      { name: "holdTimeout", type: "uint64" },
      { name: "expiry", type: "uint64" },
      { name: "nextRunAt", type: "uint64" },
    ],
  },
] as const;

export function envelopeChallenge(
  chainId: number,
  vault: Address,
  familyId: bigint,
  envelope: EnvelopeStruct,
): Hex {
  const payload = keccak256(encodeAbiParameters(ENVELOPE_ABI, [envelope]));
  return actionHash(chainId, vault, familyId, ACTION_KIND.envelope, payload);
}

/**
 * What a person's passkey signs to store their encrypted notes. The version is the NEXT
 * version, so every write needs a fresh assertion and an old one cannot roll the notes back.
 * `role` is 0 for the student and 1 for the guardian.
 */
export function notesChallenge(
  chainId: number,
  vault: Address,
  familyId: bigint,
  role: number,
  nextVersion: bigint,
  ciphertext: Hex,
): Hex {
  const payload = keccak256(
    encodeAbiParameters([{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }], [role, nextVersion, keccak256(ciphertext)]),
  );
  return actionHash(chainId, vault, familyId, ACTION_KIND.notes, payload);
}

export function resolveHoldChallenge(
  chainId: number,
  vault: Address,
  familyId: bigint,
  holdId: bigint,
  release: boolean,
): Hex {
  const payload = keccak256(
    encodeAbiParameters([{ type: "uint256" }, { type: "bool" }], [holdId, release]),
  );
  return actionHash(chainId, vault, familyId, ACTION_KIND.resolveHold, payload);
}

export function livenessChallenge(
  chainId: number,
  vault: Address,
  familyId: bigint,
  nonce: bigint,
): Hex {
  const payload = keccak256(encodeAbiParameters([{ type: "uint64" }], [nonce]));
  return actionHash(chainId, vault, familyId, ACTION_KIND.proveLiveness, payload);
}

export function unfreezeChallenge(
  chainId: number,
  vault: Address,
  familyId: bigint,
  freezeNonce: bigint,
): Hex {
  const payload = keccak256(encodeAbiParameters([{ type: "uint256" }], [freezeNonce]));
  return actionHash(chainId, vault, familyId, ACTION_KIND.unfreeze, payload);
}

export function reportChallenge(
  chainId: number,
  scamSignals: Address,
  familyId: bigint,
  handleHash: Hex,
  scriptId: number,
  holdId: bigint,
): Hex {
  const payload = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint8" }, { type: "uint256" }],
      [handleHash, scriptId, holdId],
    ),
  );
  return actionHash(chainId, scamSignals, familyId, ACTION_KIND.report, payload);
}

/**
 * The network's identifier for a payee.
 *
 * Deliberately NOT salted per family. A per-family salt would make every family's hash
 * different and the network could never match a handle, which is the whole point. So the
 * honest claim is the one in the README: hashed handles are PSEUDONYMOUS, not private.
 * Destination addresses are public onchain data anyway.
 */
export function handleHash(payee: Address): Hex {
  return keccak256(encodePacked(["address"], [payee]));
}

/** EIP-712 domain for withdraw intents, matching Solady's `EIP712` in the vault. */
export function withdrawDomain(chainId: number, vault: Address) {
  return { name: "Thunai", version: "1", chainId, verifyingContract: vault } as const;
}

export const WITHDRAW_INTENT_TYPES = {
  WithdrawIntent: [
    { name: "familyId", type: "uint256" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "memoHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
