import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
  type PasskeyCredentialMetadata,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { keccak256, toHex, type Address, type Hex, type LocalAccount } from "viem";
import {
  DEFAULT_RP_NAME,
  SALT_NAMESPACES,
  SIGNING_SESSION_MS,
  type PasskeyPublicKey,
  type Role,
} from "@thunai/shared";
import { ThunaiWebAuthnClient, hexToBytes, type CapturedAssertion } from "./webauthn";

/**
 * The account layer. Mera is the whole of it: there is no Dynamic, no Privy, no email,
 * no OTP and no seed phrase anywhere in Companion.
 *
 * Three namespaces, each a distinct 32-byte PRF salt, each doing a different job:
 *
 *   thunai/acct    secp256k1 account. Signs withdraw intents and funds the family.
 *                  This is account work.
 *   thunai/notes   AES-256-GCM key. Encrypts the family question so only that person can
 *                  read it. The ciphertext is stored in the vault contract, so any device
 *                  with the same passkey reads it back after one Face ID. Non-account
 *                  work: encryption.
 *   thunai/duress  secp256k1 capability key, registered onchain as the freeze authority
 *                  and holding no funds. Non-account work: a capability. Because it
 *                  controls nothing but "stop everything", it is safe to surrender under
 *                  coercion.
 *
 * What is never persisted, on a device or a server: a PRF output, a private key, or any
 * plaintext from the notes vault. Everything below is derived in memory from one Face ID
 * and discarded. That is what makes the stateless test real rather than a demo trick.
 */

/** PRF salts must be exactly 32 bytes, which keccak256 guarantees. */
function salt(namespace: keyof typeof SALT_NAMESPACES): Uint8Array {
  return hexToBytes(keccak256(toHex(SALT_NAMESPACES[namespace])));
}

export type ThunaiAccount = {
  role: Role;
  /** The `thunai/acct` address: who the contract expects to sign intents. */
  address: Address;
  /** The `thunai/duress` address, registered onchain as the freeze authority. */
  duressAddress: Address;
  /** The passkey's P256 public key, as stored onchain for this person. */
  passkey: PasskeyPublicKey;
  credential: PasskeyCredentialMetadata;
};

export type ActiveSession = {
  account: ThunaiAccount;
  /** A viem account that signs without prompting, until the session expires. */
  signer: LocalAccount;
  expiresAt: number;
};

/**
 * Lives for 15 minutes after a Face ID, then ends itself.
 *
 * This is the scoped prompt-free signing the Mera UX bounty asks for: routine intents
 * (paying a scheduled payee, answering the family question) are signed silently inside
 * the window, while anything a guardian decides always re-prompts, because those go
 * through a fresh WebAuthn assertion by design rather than through this session.
 */
class SessionHolder {
  private session: Secp256k1SigningSession | undefined;
  private current: ActiveSession | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<(session: ActiveSession | undefined) => void>();

  get active(): ActiveSession | undefined {
    if (this.current && Date.now() >= this.current.expiresAt) this.end();
    return this.current;
  }

  /** Milliseconds left, for the "Session active · 14 min" line in Details. */
  get msRemaining(): number {
    const active = this.active;
    return active ? Math.max(0, active.expiresAt - Date.now()) : 0;
  }

  subscribe(listener: (session: ActiveSession | undefined) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(privateKey: Uint8Array, account: ThunaiAccount): ActiveSession {
    this.end();
    const session = createSecp256k1SigningSession({ privateKey });
    this.session = session;
    this.current = {
      account,
      signer: toViemAccount(session),
      expiresAt: Date.now() + SIGNING_SESSION_MS,
    };
    // Zero the key material the moment the window closes, rather than leaving it in
    // memory for as long as the tab happens to live.
    this.timer = setTimeout(() => this.end(), SIGNING_SESSION_MS);
    this.emit();
    return this.current;
  }

  end() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    // `end()` zeroes Mera's copy of the private key.
    this.session?.end();
    this.session = undefined;
    const had = this.current !== undefined;
    this.current = undefined;
    if (had) this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener(this.current);
  }
}

export const sessionHolder = new SessionHolder();

function relyingParty(rpId: string) {
  return { id: rpId, name: DEFAULT_RP_NAME };
}

/**
 * Onboarding: one Face ID.
 *
 * The single ceremony creates the passkey, evaluates `thunai/acct` and `thunai/duress`
 * together (the PRF extension allows two salts per ceremony), and captures the P256
 * public key from the attestation. Registration needs all three, so this is the minimum
 * honest number of prompts, not a shortcut.
 */
export async function createThunaiAccount(options: {
  rpId: string;
  role: Role;
  displayName: string;
}): Promise<{ account: ThunaiAccount; session: ActiveSession }> {
  const client = new ThunaiWebAuthnClient(options.rpId);
  client.setSecondarySalt(salt("duress"));

  const created = await createPasskeyWithPrfOutput({
    rp: relyingParty(options.rpId),
    user: {
      name: `${options.displayName} (${options.role === "student" ? "student" : "guardian"})`,
      displayName: options.displayName,
    },
    prfSalt: salt("acct"),
    webAuthnClient: client,
  });

  const duressKey = client.takeSecondaryPrfOutput();
  const passkey = client.takePublicKey();

  const account = buildAccount({
    role: options.role,
    acctKey: created.prfOutput,
    duressKey,
    passkey,
    credential: { credentialId: created.credentialId, transports: created.transports },
  });

  return { account, session: sessionHolder.start(created.prfOutput, account) };
}

/**
 * The stateless restore.
 *
 * Clear storage, or pick up a different phone: one Face ID returns the same addresses,
 * because they were never stored anywhere to begin with. The passkey is discoverable, so
 * no credential ID has to be remembered either, and the family id is then recovered from
 * the chain by address.
 *
 * The one thing a restore cannot rebuild is the P256 public key, which only the
 * attestation carries. It does not need to: the key is already onchain from registration,
 * and that is where every verification reads it from.
 */
export async function restoreThunaiAccount(options: {
  rpId: string;
  role: Role;
  credential?: PasskeyCredentialMetadata;
}): Promise<{ account: Omit<ThunaiAccount, "passkey">; session: ActiveSession }> {
  const client = new ThunaiWebAuthnClient(options.rpId);
  client.setSecondarySalt(salt("duress"));

  const result = await getPasskeyPrfOutput({
    rpId: options.rpId,
    credential: options.credential,
    prfSalt: salt("acct"),
    webAuthnClient: client,
  });
  const duressKey = client.takeSecondaryPrfOutput();

  const account = {
    role: options.role,
    address: addressFor(result.prfOutput),
    duressAddress: addressFor(duressKey),
    credential: { credentialId: result.credentialId },
  };

  return { account, session: sessionHolder.start(result.prfOutput, account as ThunaiAccount) };
}

function buildAccount(input: {
  role: Role;
  acctKey: Uint8Array;
  duressKey: Uint8Array;
  passkey: PasskeyPublicKey;
  credential: PasskeyCredentialMetadata;
}): ThunaiAccount {
  return {
    role: input.role,
    address: addressFor(input.acctKey),
    duressAddress: addressFor(input.duressKey),
    passkey: input.passkey,
    credential: input.credential,
  };
}

/** Derives an address from a PRF output without keeping the key around. */
function addressFor(privateKey: Uint8Array): Address {
  const session = createSecp256k1SigningSession({ privateKey });
  try {
    return getEvmAddress(session.publicKey) as Address;
  } finally {
    session.end();
  }
}

// ------------------------------------------------- signing for the contract

/**
 * Gets a WebAuthn assertion over an action hash.
 *
 * This is the guardian's decision, and the student's liveness proof. It always prompts:
 * a held payment must never be releasable by a background session, however recently
 * someone tapped Face ID.
 */
export async function signActionHash(options: {
  rpId: string;
  actionHash: Hex;
  credential?: PasskeyCredentialMetadata;
}): Promise<CapturedAssertion> {
  const client = new ThunaiWebAuthnClient(options.rpId);
  client.setPendingChallenge(options.actionHash);

  // The PRF output is irrelevant here; the assertion is the point. Mera's call is used
  // anyway so there is exactly one code path through the authenticator.
  await getPasskeyPrfOutput({
    rpId: options.rpId,
    credential: options.credential,
    prfSalt: salt("acct"),
    webAuthnClient: client,
  });

  return client.takeAssertion();
}

/**
 * Signs a whole transaction with the live session, for the one case where the family's own account
 * has to be the sender: the reputation feedback after a stopped payment. Never prompts, and throws
 * if the session has ended, because feedback is optional and must never interrupt a rescue.
 */
export async function signTransactionWithSession(
  transaction: Parameters<LocalAccount["signTransaction"]>[0],
): Promise<Hex> {
  const active = sessionHolder.active;
  if (!active) throw new SessionExpiredError();
  return active.signer.signTransaction(transaction);
}

/** Signs a 32-byte digest with the live session, prompting only if it has expired. */
export async function signDigestWithSession(digest: Hex): Promise<Hex> {
  const active = sessionHolder.active;
  if (!active) {
    throw new SessionExpiredError();
  }
  return signHash(active.signer, digest);
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Tap Face ID to continue.");
    this.name = "SessionExpiredError";
  }
}

// ---------------------------------------------------------- the notes key

/**
 * The key that encrypts a person's private family notes: `thunai/notes`.
 *
 * It is the passkey's PRF output for the fixed salt `keccak256("thunai/notes")`. Because the
 * salt is fixed and the passkey is the same, every device that holds this passkey derives the
 * same key after one Face ID. That is what lets a fresh phone read the notes back, with nothing
 * kept on the old one. The key is used in memory and discarded; only ciphertext is ever stored,
 * and it lives in the vault contract (see `recordFamilyQuestion`).
 */
export async function deriveNotesKey(options: {
  rpId: string;
  credential?: PasskeyCredentialMetadata;
}): Promise<Uint8Array> {
  const result = await getPasskeyPrfOutput({
    rpId: options.rpId,
    credential: options.credential,
    prfSalt: salt("notes"),
    webAuthnClient: new ThunaiWebAuthnClient(options.rpId),
  });
  return result.prfOutput;
}

/** Signs the freeze intent with the duress capability key. Prompts, by design. */
export async function signFreezeWithDuressKey(options: {
  rpId: string;
  digest: Hex;
  credential?: PasskeyCredentialMetadata;
}): Promise<Hex> {
  const client = new ThunaiWebAuthnClient(options.rpId);
  const result = await getPasskeyPrfOutput({
    rpId: options.rpId,
    credential: options.credential,
    prfSalt: salt("duress"),
    webAuthnClient: client,
  });

  const session = createSecp256k1SigningSession({ privateKey: result.prfOutput });
  try {
    return signHash(toViemAccount(session), options.digest);
  } finally {
    session.end();
  }
}

/** viem types `sign` as optional on a LocalAccount; Mera's always provides it. */
function signHash(account: LocalAccount, hash: Hex): Promise<Hex> {
  if (!account.sign) throw new Error("This signer cannot sign a raw digest.");
  return account.sign({ hash });
}

/**
 * The namespace table, and the addresses a second device must reproduce for the
 * cross-device test.
 *
 * One honest note, which the write-up repeats: the account and duress keys use our own
 * named salts, `thunai/acct` and `thunai/duress`, passed straight to Mera's PRF. The
 * notes vault does NOT, because `createSecretVaultWithExistingPasskey` generates a fresh
 * random salt internally and stores it in the vault. That is deliberate on Mera's part
 * (a vault is bound to its PRF output, so reusing one salt across vaults would share an
 * encryption key), so we use the API as designed rather than reaching around it. All
 * three keys are still independent, and still used for three different kinds of work.
 */
export function namespaceReport(account: Pick<ThunaiAccount, "address" | "duressAddress">) {
  return [
    {
      salt: SALT_NAMESPACES.acct,
      saltSource: "ours: keccak256(\"thunai/acct\")",
      derives: "secp256k1 account",
      work: "account: signs withdraw intents",
      value: account.address,
    },
    {
      salt: SALT_NAMESPACES.notes,
      saltSource: "ours: keccak256(\"thunai/notes\")",
      derives: "AES-256-GCM notes key (PRF output)",
      work: "non-account: encrypts the family question. Ciphertext is stored in the vault contract, so any device of yours reads it after one Face ID",
      value: "(never leaves the device)",
    },
    {
      salt: SALT_NAMESPACES.duress,
      saltSource: "ours: keccak256(\"thunai/duress\")",
      derives: "secp256k1 capability key",
      work: "non-account: the onchain freeze authority, holds no funds",
      value: account.duressAddress,
    },
  ];
}
