/**
 * A software passkey, for tests and the local end-to-end run.
 *
 * This produces the exact same bytes a real iPhone or Android authenticator produces for
 * an assertion: a 37-byte authenticatorData with the User Verified flag set, a
 * clientDataJSON carrying the challenge as unpadded base64url, and a low-s secp256r1
 * signature over `sha256(authData || sha256(clientDataJSON))`.
 *
 * Because the format is identical, anything that verifies here verifies on a phone, and
 * the byte offsets (`challengeIndex`, `typeIndex`) are checked rather than assumed.
 */
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, concatBytes } from "@noble/hashes/utils.js";

/** The relying party. Passkeys are scoped to this host. */
export const RP_ID = "thunai.app";
export const ORIGIN = "https://thunai.app";

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

/** Creates a passkey. In the real app this is one Face ID ceremony. */
export function createPasskey(seedHex) {
  const privateKey = hexToBytes(seedHex.replace(/^0x/, "").padStart(64, "0"));
  const publicKey = p256.getPublicKey(privateKey, false); // 65 bytes, 0x04 || x || y
  return {
    privateKey,
    /** The P256 public key the contract stores at registration. */
    x: bytesToHex(publicKey.slice(1, 33)),
    y: bytesToHex(publicKey.slice(33, 65)),
  };
}

/**
 * Signs an action hash, returning a `WebAuthnAuth` ready for the contract.
 *
 * @param passkey from `createPasskey`
 * @param challengeHex the 32-byte action hash the contract will recompute
 * @param options.userVerified set false to simulate a presence-only tap, which the
 *        contract must reject
 */
export function signAssertion(passkey, challengeHex, { userVerified = true, counter = 1 } = {}) {
  const challenge = hexToBytes(challengeHex.replace(/^0x/, ""));
  if (challenge.length !== 32) throw new Error(`challenge must be 32 bytes, got ${challenge.length}`);

  const clientDataJSON = JSON.stringify({
    type: "webauthn.get",
    challenge: base64url(challenge),
    origin: ORIGIN,
    crossOrigin: false,
  });

  // JSON.stringify emits keys in insertion order, so "type" is first and "challenge"
  // second. Compute the offsets rather than trusting that, so a format change is caught
  // here instead of as an opaque revert.
  const typeIndex = clientDataJSON.indexOf('"type":"');
  const challengeIndex = clientDataJSON.indexOf('"challenge":"');
  if (typeIndex < 0 || challengeIndex < 0) throw new Error("clientDataJSON is missing a required field");

  const rpIdHash = sha256(new TextEncoder().encode(RP_ID));
  const flags = FLAG_USER_PRESENT | (userVerified ? FLAG_USER_VERIFIED : 0);
  const counterBytes = new Uint8Array(4);
  new DataView(counterBytes.buffer).setUint32(0, counter, false);
  const authenticatorData = concatBytes(rpIdHash, new Uint8Array([flags]), counterBytes);

  const clientDataHash = sha256(new TextEncoder().encode(clientDataJSON));
  const message = sha256(concatBytes(authenticatorData, clientDataHash));

  // `lowS` matters: Solady rejects the high-s form as malleable. noble returns the
  // compact 64-byte `r || s` form directly.
  const compact = p256.sign(message, passkey.privateKey, { lowS: true, prehash: false });

  return {
    authenticatorData: `0x${bytesToHex(authenticatorData)}`,
    clientDataJSON,
    challengeIndex,
    typeIndex,
    r: `0x${bytesToHex(compact.slice(0, 32))}`,
    s: `0x${bytesToHex(compact.slice(32, 64))}`,
  };
}
