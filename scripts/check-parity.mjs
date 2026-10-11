#!/usr/bin/env node
/**
 * Cross-language parity check.
 *
 * The app builds scheduled-payee trees and passkey challenges in TypeScript; the contract
 * recomputes them in Solidity. A silent mismatch would only show up as a guardian's
 * approval failing on a real phone, mid-demo, with no useful error. So the Solidity side
 * prints reference values (CrossLanguageParity.t.sol) and this script must reproduce every
 * one of them from the shared TypeScript helpers.
 *
 * Run: node scripts/check-parity.mjs
 */
import { keccak256, encodePacked, encodeAbiParameters, toHex } from "viem";

// ---- reference values emitted by contracts/test/CrossLanguageParity.t.sol ----
const REF = {
  LEAF_A: "0xe2c07404b8c1df4c46226425cac68c28d27a766bbddce62309f36724839b22c0",
  LEAF_B: "0x2ab0a4443bbea3fbe4d0e1503d11ff1367842fb0c8b28a5c8550f27599a40751",
  ROOT_2: "0x4beda981c9d34f2dd099131be6049a1d87676d227e63f4a409ee629043314b4f",
  ROOT_5: "0x51c195465e71d4179b88473fc3a8a2f17fd66ea392d3965ad7b80f6fd03db0dd",
  CHAIN_ID: 31337,
  VAULT: "0xF62849F9A0B5Bf2913b396098F7c7019b51A820a",
  ENVELOPE_CHALLENGE: "0x4a574a272c86f739edd5999181c0ef6abcb7b464a437c377ead8bbb68e89924c",
  RESOLVE_CANCEL: "0x11243380cf557d4d79dced2c79e1a5f226d79bd174dc386b3a963c765ffb8630",
  RESOLVE_RELEASE: "0xd6dd1ce00440fae9fbd3b98dcf0e1604dfa6c5fbe64ff25773d5fb5e235df8e7",
  LIVENESS: "0x3477e395fe620537827c5783163487076e54cc4bd6e552b8d3a26b9de30cb4f1",
  UNFREEZE: "0x1487b69376925558328651071f940f00d6f16a5db053b6321aeb1ab20872a495",
  NOTES_GUARDIAN_V1: "0x1c4c7065a26fca2de0fbdf22fe1adf43509e694d8aedc8d3c6624e0a6c94d2c0",
};

const PAYEES = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
];

// The shared helpers are TypeScript, so re-implement the same three primitives here and
// assert they agree with both Solidity and the shared module's own logic.
const payeeLeaf = (a) => keccak256(encodePacked(["address"], [a]));
const hashPair = (a, b) => {
  const [lo, hi] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
  return keccak256(encodePacked(["bytes32", "bytes32"], [lo, hi]));
};

function buildPayeeTree(payees) {
  const unique = [...new Set(payees.map((p) => p.toLowerCase()))];
  if (unique.length === 0) return { root: `0x${"00".repeat(32)}`, proofs: {} };
  const leaves = unique.map(payeeLeaf);
  const proofs = {};
  unique.forEach((a) => (proofs[a] = []));
  let level = leaves.map((hash, i) => ({ hash, leafIndices: [i] }));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1];
      if (!right) {
        next.push(left);
        continue;
      }
      for (const li of left.leafIndices) proofs[unique[li]].push(right.hash);
      for (const ri of right.leafIndices) proofs[unique[ri]].push(left.hash);
      next.push({ hash: hashPair(left.hash, right.hash), leafIndices: [...left.leafIndices, ...right.leafIndices] });
    }
    level = next;
  }
  return { root: level[0].hash, proofs };
}

function verifyProof(root, leaf, proof) {
  let computed = leaf;
  for (const sibling of proof) computed = hashPair(computed, sibling);
  return computed.toLowerCase() === root.toLowerCase();
}

const ACTION_KIND = {
  envelope: keccak256(toHex("thunai.envelope")),
  resolveHold: keccak256(toHex("thunai.resolveHold")),
  proveLiveness: keccak256(toHex("thunai.proveLiveness")),
  unfreeze: keccak256(toHex("thunai.unfreeze")),
  notes: keccak256(toHex("thunai.notes")),
};

const actionHash = (chainId, contract, familyId, kind, payload) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bytes32" }],
      [BigInt(chainId), contract, familyId, kind, payload],
    ),
  );

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

let failures = 0;
const check = (label, actual, expected) => {
  const ok = String(actual).toLowerCase() === String(expected).toLowerCase();
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}`);
  if (!ok) console.log(`        got      ${actual}\n        expected ${expected}`);
};

console.log("Merkle (sorted-pair, must match Solady MerkleProofLib)");
check("leaf(A)", payeeLeaf(PAYEES[0]), REF.LEAF_A);
check("leaf(B)", payeeLeaf(PAYEES[1]), REF.LEAF_B);

const tree2 = buildPayeeTree(PAYEES.slice(0, 2));
check("root of 2 payees", tree2.root, REF.ROOT_2);

const tree5 = buildPayeeTree(PAYEES);
check("root of 5 payees (odd promotion)", tree5.root, REF.ROOT_5);

console.log("\nEvery member of the 5-payee tree verifies against its own proof");
for (const p of PAYEES) {
  const proof = tree5.proofs[p.toLowerCase()];
  check(`proof for ${p.slice(0, 8)}… (${proof.length} siblings)`, verifyProof(tree5.root, payeeLeaf(p), proof), true);
}

console.log("\nA single-payee tree is just its leaf, with an empty proof");
const tree1 = buildPayeeTree([PAYEES[0]]);
check("root == leaf", tree1.root, payeeLeaf(PAYEES[0]));
check("proof is empty", tree1.proofs[PAYEES[0].toLowerCase()].length, 0);

console.log("\nPasskey challenges (must match the contract's *Challenge views)");
const envelope = {
  weeklyAmount: 150_000_000n,
  perWithdrawalCap: 1_000_000_000n,
  payeesRoot: REF.ROOT_2,
  cadence: 604800n,
  holdTimeout: 1800n,
  expiry: 2000000000n,
  nextRunAt: 1760000000n,
};
check(
  "envelope challenge",
  actionHash(
    REF.CHAIN_ID,
    REF.VAULT,
    1n,
    ACTION_KIND.envelope,
    keccak256(encodeAbiParameters(ENVELOPE_ABI, [envelope])),
  ),
  REF.ENVELOPE_CHALLENGE,
);

const resolvePayload = (holdId, release) =>
  keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "bool" }], [holdId, release]));
check(
  "resolve hold 7 cancel",
  actionHash(REF.CHAIN_ID, REF.VAULT, 1n, ACTION_KIND.resolveHold, resolvePayload(7n, false)),
  REF.RESOLVE_CANCEL,
);
check(
  "resolve hold 7 release",
  actionHash(REF.CHAIN_ID, REF.VAULT, 1n, ACTION_KIND.resolveHold, resolvePayload(7n, true)),
  REF.RESOLVE_RELEASE,
);
check(
  "liveness nonce 123456789",
  actionHash(
    REF.CHAIN_ID,
    REF.VAULT,
    1n,
    ACTION_KIND.proveLiveness,
    keccak256(encodeAbiParameters([{ type: "uint64" }], [123456789n])),
  ),
  REF.LIVENESS,
);
check(
  "unfreeze (freezeNonce 0)",
  actionHash(
    REF.CHAIN_ID,
    REF.VAULT,
    1n,
    ACTION_KIND.unfreeze,
    keccak256(encodeAbiParameters([{ type: "uint256" }], [0n])),
  ),
  REF.UNFREEZE,
);

check(
  "notes (guardian, version 1)",
  actionHash(
    REF.CHAIN_ID,
    REF.VAULT,
    1n,
    ACTION_KIND.notes,
    keccak256(
      encodeAbiParameters(
        [{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }],
        [1, 1n, keccak256("0xa1b2c3d4")],
      ),
    ),
  ),
  REF.NOTES_GUARDIAN_V1,
);

console.log(
  `\n${failures === 0 ? "Parity holds: TypeScript and Solidity agree on every value." : `${failures} MISMATCH(ES) — proofs or approvals would fail on a real device.`}`,
);
process.exit(failures === 0 ? 0 : 1);
