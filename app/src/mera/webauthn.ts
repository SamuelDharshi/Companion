import type { WebAuthnClient } from "@category-labs/mera";
import type { Hex } from "viem";
import type { PasskeyPublicKey, WebAuthnAuth } from "@thunai/shared";

/**
 * The custom WebAuthn client. This is the piece the whole design rests on.
 *
 * Mera gives us an account from a passkey's PRF output. The contract needs something
 * different: a WebAuthn assertion over OUR action hash, so it can verify the guardian at
 * the P256 precompile. Two separate things from one authenticator.
 *
 * The PRD assumed we could set the challenge through Mera and flagged "does Mera overwrite
 * it?" as a day-0 risk. Reading Mera 0.2.0 settles it, and in our favour:
 *
 *   - Mera generates a random 32-byte challenge internally and passes it to this client,
 *   - Mera never inspects the returned assertion; it reads only `prfOutput`,
 *   - there is no server in Mera's model, so nothing verifies that challenge at all.
 *
 * So this client is free to substitute the pending action hash for Mera's random challenge
 * and keep the full assertion on the side. One Face ID, two artefacts: Mera gets its PRF
 * output, and the contract gets a verifiable signature over the exact action being
 * authorised. No second prompt, and no need for the @simplewebauthn fallback.
 *
 * The other thing only this client can do: capture the credential's P256 public key at
 * creation. Mera's result type does not carry it, and the contract needs x and y to verify
 * anything later, so it is read from the attestation here and nowhere else.
 */

export type CapturedAssertion = WebAuthnAuth & {
  credentialId: string;
};

export class ThunaiWebAuthnClient implements WebAuthnClient {
  /** The action hash the next assertion must sign, if any. */
  private pendingChallenge: Uint8Array | undefined;
  private lastAssertion: CapturedAssertion | undefined;
  private capturedPublicKey: PasskeyPublicKey | undefined;
  /** A second PRF salt to evaluate in the same ceremony, if any. */
  private secondarySalt: Uint8Array | undefined;
  private secondaryPrfOutput: Uint8Array | undefined;

  constructor(private readonly rpId: string) {}

  /**
   * Arms the next ceremony with an action hash.
   *
   * Set this immediately before the Mera call that will prompt for Face ID. It is
   * consumed by that one ceremony and cleared, so a stale hash can never be signed by a
   * later, unrelated prompt.
   */
  setPendingChallenge(actionHash: Hex) {
    this.pendingChallenge = hexToBytes(actionHash);
    if (this.pendingChallenge.length !== 32) {
      throw new Error(`action hash must be 32 bytes, got ${this.pendingChallenge.length}`);
    }
  }

  /**
   * Asks the next ceremony to evaluate a second PRF salt as well.
   *
   * The WebAuthn PRF extension evaluates up to two salts per ceremony (`first` and
   * `second`), but Mera's client contract only carries one. Setting the second here is
   * what lets onboarding stay at a single Face ID while still deriving two keys from two
   * genuinely distinct namespaces: `thunai/acct` for the account and `thunai/duress` for
   * the freeze capability, both of which registration needs up front.
   *
   * The third namespace, `thunai/notes`, is derived later, the first time the family
   * records their question, so no key is ever derived before it is needed.
   */
  setSecondarySalt(salt: Uint8Array) {
    if (salt.length !== 32) throw new Error("a PRF salt must be exactly 32 bytes");
    this.secondarySalt = salt;
  }

  /** Takes the second PRF output from the last ceremony, clearing it. */
  takeSecondaryPrfOutput(): Uint8Array {
    const output = this.secondaryPrfOutput;
    this.secondaryPrfOutput = undefined;
    this.secondarySalt = undefined;
    if (!output) {
      throw new Error(
        "This device did not return a second PRF output. Companion needs a passkey that supports the PRF extension.",
      );
    }
    return output;
  }

  /** Takes the assertion from the last ceremony, clearing it. */
  takeAssertion(): CapturedAssertion {
    const assertion = this.lastAssertion;
    this.lastAssertion = undefined;
    if (!assertion) {
      throw new Error("No assertion was captured. Was a challenge armed before the prompt?");
    }
    return assertion;
  }

  /** The P256 public key read from the attestation, available only after a create. */
  takePublicKey(): PasskeyPublicKey {
    if (!this.capturedPublicKey) {
      throw new Error("No passkey public key captured. Create the passkey first.");
    }
    return this.capturedPublicKey;
  }

  // -------------------------------------------------------------- ceremonies

  async createCredential(
    request: WebAuthnClient.CreateCredentialRequest,
  ): Promise<WebAuthnClient.CreateCredentialResult> {
    assertWebAuthnAvailable();

    const credential = (await navigator.credentials.create({
      publicKey: {
        rp: { id: request.rp.id, name: request.rp.name },
        user: {
          id: request.user.id as BufferSource,
          name: request.user.name,
          displayName: request.user.displayName,
        },
        challenge: request.challenge as BufferSource,
        pubKeyCredParams: request.algorithms.map((alg) => ({ type: "public-key", alg })),
        authenticatorSelection: {
          residentKey: request.residentKey,
          requireResidentKey: true,
          userVerification: request.userVerification,
        },
        attestation: request.attestation,
        timeout: request.timeout,
        // PRF is what Mera derives every key from. Evaluating both salts during creation
        // means one ceremony instead of two.
        extensions: {
          prf: { eval: this.prfEval(request.prfSalt) },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;

    if (!credential) throw new Error("Passkey creation was cancelled.");

    const response = credential.response as AuthenticatorAttestationResponse;

    // Capture the P256 public key now; there is no second chance to read it.
    const spki = response.getPublicKey?.();
    if (spki) {
      this.capturedPublicKey = publicKeyFromSpki(new Uint8Array(spki));
    }

    const extensions = credential.getClientExtensionResults() as PrfExtensionResults;
    const prfOutput = extensions.prf?.results?.first
      ? new Uint8Array(extensions.prf.results.first)
      : undefined;
    this.captureSecondary(extensions);

    return {
      credentialId: new Uint8Array(credential.rawId),
      transports: response.getTransports?.() ?? undefined,
      prfEnabled: extensions.prf?.enabled ?? prfOutput !== undefined,
      prfOutput,
    };
  }

  async getCredential(
    request: WebAuthnClient.GetCredentialRequest,
  ): Promise<WebAuthnClient.GetCredentialResult> {
    assertWebAuthnAvailable();

    // The substitution: if an action hash is armed, it becomes the challenge, so the
    // signature the authenticator produces is over the action the contract will check.
    // Otherwise Mera's own random challenge is used, which is correct for a plain
    // key-derivation prompt such as restoring on a new device.
    const challenge = this.pendingChallenge ?? (request.challenge as Uint8Array);
    const armed = this.pendingChallenge !== undefined;
    this.pendingChallenge = undefined;

    const credential = (await navigator.credentials.get({
      publicKey: {
        rpId: request.rpId,
        challenge: challenge as BufferSource,
        allowCredentials: request.allowCredential
          ? [
              {
                type: "public-key",
                id: request.allowCredential.credentialId as BufferSource,
                transports: request.allowCredential.transports as AuthenticatorTransport[] | undefined,
              },
            ]
          : undefined,
        userVerification: request.userVerification,
        timeout: request.timeout,
        extensions: {
          prf: { eval: this.prfEval(request.prfSalt) },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;

    if (!credential) throw new Error("Face ID was cancelled.");

    const response = credential.response as AuthenticatorAssertionResponse;

    if (armed) {
      this.lastAssertion = buildAuth(credential, response);
    }

    const extensions = credential.getClientExtensionResults() as PrfExtensionResults;
    const prfOutput = extensions.prf?.results?.first
      ? new Uint8Array(extensions.prf.results.first)
      : undefined;
    this.captureSecondary(extensions);

    return { credentialId: new Uint8Array(credential.rawId), prfOutput };
  }

  // ----------------------------------------------------------------- PRF

  private prfEval(first: Uint8Array): { first: Uint8Array; second?: Uint8Array } {
    return this.secondarySalt ? { first, second: this.secondarySalt } : { first };
  }

  private captureSecondary(extensions: PrfExtensionResults) {
    if (!this.secondarySalt) return;
    const second = extensions.prf?.results?.second;
    this.secondaryPrfOutput = second ? new Uint8Array(second) : undefined;
  }
}

// ----------------------------------------------------------------- helpers

type PrfExtensionResults = {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer; second?: ArrayBuffer } };
};

function assertWebAuthnAvailable() {
  if (typeof navigator === "undefined" || !navigator.credentials?.create) {
    throw new Error(
      "This device cannot use passkeys. Open Companion in Safari on iPhone or Chrome on Android.",
    );
  }
}

/** Shapes a browser assertion into what Solady's `WebAuthn.verify` expects. */
function buildAuth(
  credential: PublicKeyCredential,
  response: AuthenticatorAssertionResponse,
): CapturedAssertion {
  const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);

  // The offsets are computed from the actual JSON rather than assumed. Different
  // platforms order the keys differently, and the contract reads at these exact indices.
  const typeIndex = clientDataJSON.indexOf('"type":"');
  const challengeIndex = clientDataJSON.indexOf('"challenge":"');
  if (typeIndex < 0 || challengeIndex < 0) {
    throw new Error("The authenticator returned clientDataJSON in an unexpected shape.");
  }

  const { r, s } = derToRs(new Uint8Array(response.signature));

  return {
    credentialId: bufferToBase64Url(credential.rawId),
    authenticatorData: bytesToHex(new Uint8Array(response.authenticatorData)),
    clientDataJSON,
    challengeIndex: BigInt(challengeIndex),
    typeIndex: BigInt(typeIndex),
    r,
    s,
  };
}

/** Order of the secp256r1 curve, for the low-s normalisation Solady requires. */
const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

/**
 * WebAuthn returns an ASN.1 DER ECDSA signature; the contract wants raw r and s.
 *
 * The high-s form is also rejected onchain as malleable, so s is folded into its low
 * form here. Without this, roughly half of all real assertions would fail to verify,
 * which is the kind of bug that looks like "passkeys are flaky".
 */
export function derToRs(der: Uint8Array): { r: Hex; s: Hex } {
  if (der[0] !== 0x30) throw new Error("signature is not DER");
  let offset = 2;
  // DER may use a long-form length byte for the sequence.
  if (der[1] !== undefined && der[1] > 0x80) offset = 3;

  if (der[offset] !== 0x02) throw new Error("malformed DER: expected integer for r");
  const rLength = der[offset + 1]!;
  const rBytes = der.slice(offset + 2, offset + 2 + rLength);

  const sOffset = offset + 2 + rLength;
  if (der[sOffset] !== 0x02) throw new Error("malformed DER: expected integer for s");
  const sLength = der[sOffset + 1]!;
  const sBytes = der.slice(sOffset + 2, sOffset + 2 + sLength);

  const r = BigInt(`0x${bytesToRawHex(rBytes)}`);
  let s = BigInt(`0x${bytesToRawHex(sBytes)}`);
  if (s > P256_N / 2n) s = P256_N - s;

  return { r: toHex32(r), s: toHex32(s) };
}

/**
 * Pulls x and y out of an SPKI-encoded P256 public key.
 *
 * `getPublicKey()` returns SubjectPublicKeyInfo, whose final 65 bytes are the
 * uncompressed point `0x04 || x || y`. Reading from the end avoids parsing the ASN.1
 * prefix, which is fixed for P256 anyway.
 */
export function publicKeyFromSpki(spki: Uint8Array): PasskeyPublicKey {
  const point = spki.slice(-65);
  if (point[0] !== 0x04) {
    throw new Error("Expected an uncompressed P256 public key in the attestation.");
  }
  return {
    x: bytesToHex(point.slice(1, 33)),
    y: bytesToHex(point.slice(33, 65)),
  };
}

function toHex32(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function bytesToRawHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${bytesToRawHex(bytes)}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
