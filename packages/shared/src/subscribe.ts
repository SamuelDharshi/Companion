import { encodeAbiParameters, keccak256, type Hex } from "viem";

/**
 * What a device signs to subscribe to a family's alerts.
 *
 * Without it, anyone who knew a family id could register their own browser and read that family's
 * alerts: the amounts, the names and the video-call link. The signature comes from the person's
 * `thunai/acct` key, which the contract already knows, so only the student's or the guardian's own
 * phone can subscribe for their own role. The endpoint is part of the digest, so a signature for one
 * device cannot be reused to register another.
 */
export function subscribeDigest(familyId: bigint, role: "student" | "guardian", endpoint: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "uint256" }, { type: "string" }, { type: "string" }],
      ["thunai.subscribe", familyId, role, endpoint],
    ),
  );
}
