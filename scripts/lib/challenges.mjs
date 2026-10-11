/**
 * Plain-JS mirror of `@thunai/shared/challenges` for the Node scripts.
 *
 * Kept byte-for-byte identical to the TypeScript module and to the Solidity views;
 * `scripts/check-parity.mjs` asserts all three agree.
 */
import { encodeAbiParameters, keccak256, toHex } from "viem";

export const ACTION_KIND = {
  envelope: keccak256(toHex("thunai.envelope")),
  resolveHold: keccak256(toHex("thunai.resolveHold")),
  proveLiveness: keccak256(toHex("thunai.proveLiveness")),
  unfreeze: keccak256(toHex("thunai.unfreeze")),
  notes: keccak256(toHex("thunai.notes")),
  report: keccak256(toHex("thunai.report")),
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
];

function actionHash(chainId, contract, familyId, kind, payload) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bytes32" }],
      [BigInt(chainId), contract, BigInt(familyId), kind, payload],
    ),
  );
}

export function envelopeChallenge(chainId, vault, familyId, envelope) {
  const payload = keccak256(encodeAbiParameters(ENVELOPE_ABI, [envelope]));
  return actionHash(chainId, vault, familyId, ACTION_KIND.envelope, payload);
}

export function resolveHoldChallenge(chainId, vault, familyId, holdId, release) {
  const payload = keccak256(
    encodeAbiParameters([{ type: "uint256" }, { type: "bool" }], [BigInt(holdId), release]),
  );
  return actionHash(chainId, vault, familyId, ACTION_KIND.resolveHold, payload);
}

export function livenessChallenge(chainId, vault, familyId, nonce) {
  const payload = keccak256(encodeAbiParameters([{ type: "uint64" }], [BigInt(nonce)]));
  return actionHash(chainId, vault, familyId, ACTION_KIND.proveLiveness, payload);
}

export function unfreezeChallenge(chainId, vault, familyId, freezeNonce) {
  const payload = keccak256(encodeAbiParameters([{ type: "uint256" }], [BigInt(freezeNonce)]));
  return actionHash(chainId, vault, familyId, ACTION_KIND.unfreeze, payload);
}

export function notesChallenge(chainId, vault, familyId, role, nextVersion, ciphertext) {
  const payload = keccak256(
    encodeAbiParameters([{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }], [role, BigInt(nextVersion), keccak256(ciphertext)]),
  );
  return actionHash(chainId, vault, familyId, ACTION_KIND.notes, payload);
}

export function reportChallenge(chainId, scamSignals, familyId, handleHash, scriptId, holdId) {
  const payload = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint8" }, { type: "uint256" }],
      [handleHash, scriptId, BigInt(holdId)],
    ),
  );
  return actionHash(chainId, scamSignals, familyId, ACTION_KIND.report, payload);
}
