import { encodePacked, keccak256, type Address, type Hex } from "viem";

/**
 * Scheduled-payee merkle tree.
 *
 * The guardian signs one root; the vault later accepts a proof that a payee is on it.
 * Payees on the root are immune to network flags, which is what keeps a hostile network
 * from ever stopping a family's rent.
 *
 * Solady's `MerkleProofLib` hashes a pair in SORTED order (it compares the two 32-byte
 * words and puts the smaller first), so this builder must do exactly the same or no proof
 * will ever verify onchain. There is a test asserting the two agree.
 */

/** Leaf for a payee address: `keccak256(abi.encodePacked(address))`. */
export function payeeLeaf(address: Address): Hex {
  return keccak256(encodePacked(["address"], [address]));
}

/** Sorted-pair parent hash, matching Solady. */
export function hashPair(a: Hex, b: Hex): Hex {
  const [lo, hi] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
  return keccak256(encodePacked(["bytes32", "bytes32"], [lo, hi]));
}

export type PayeeTree = {
  root: Hex;
  /** Proof for each payee address, keyed by lowercase address. */
  proofs: Record<string, Hex[]>;
  leaves: Hex[];
};

/**
 * Builds the tree for a family's scheduled payees.
 *
 * An empty list yields a zero root, which the vault reads as "no schedule at all", so
 * every payee is treated as new. That is the safe default for a family that has not set
 * an envelope yet.
 */
export function buildPayeeTree(payees: readonly Address[]): PayeeTree {
  const unique = [...new Set(payees.map((p) => p.toLowerCase() as Address))];
  if (unique.length === 0) {
    return { root: `0x${"00".repeat(32)}`, proofs: {}, leaves: [] };
  }

  const leaves = unique.map(payeeLeaf);
  // Track, for every leaf, the siblings it needs on the way up.
  const proofs: Record<string, Hex[]> = {};
  unique.forEach((addr) => {
    proofs[addr] = [];
  });

  // Each level keeps, per node, the set of leaf indices beneath it, so a sibling can be
  // handed to exactly the leaves that need it.
  let level: { hash: Hex; leafIndices: number[] }[] = leaves.map((hash, i) => ({
    hash,
    leafIndices: [i],
  }));

  while (level.length > 1) {
    const next: { hash: Hex; leafIndices: number[] }[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1];

      if (!right) {
        // An odd node is promoted unchanged; it gains no sibling at this level.
        next.push(left);
        continue;
      }

      for (const li of left.leafIndices) proofs[unique[li]!]!.push(right.hash);
      for (const ri of right.leafIndices) proofs[unique[ri]!]!.push(left.hash);

      next.push({
        hash: hashPair(left.hash, right.hash),
        leafIndices: [...left.leafIndices, ...right.leafIndices],
      });
    }
    level = next;
  }

  return { root: level[0]!.hash, proofs, leaves };
}

/** Proof for one payee, or an empty array when the payee is not on the schedule. */
export function proofFor(tree: PayeeTree, payee: Address): Hex[] {
  return tree.proofs[payee.toLowerCase()] ?? [];
}

/** Local mirror of Solady's `verify`, used by tests and by the relayer as a pre-flight check. */
export function verifyProof(root: Hex, leaf: Hex, proof: readonly Hex[]): boolean {
  let computed = leaf;
  for (const sibling of proof) computed = hashPair(computed, sibling);
  return computed.toLowerCase() === root.toLowerCase();
}
