/**
 * Shared constants. Every package reads these so a reason code or a salt is never
 * written down twice.
 */

/** Monad testnet. Sub-second finality is what lets the rescue finish while the scammer is still on the line. */
export const MONAD_TESTNET_CHAIN_ID = 10143;

/** EIP-7951 secp256r1 precompile on Monad: it verifies a passkey from another continent inside the contract. */
export const P256_PRECOMPILE = "0x0000000000000000000000000000000000000100" as const;

/** Agora Instant Settlement on Monad testnet. */
export const AGORA = {
  instantSettlementFactory: "0x8468587Af422ad440F58a57E955eCA6A970b5375",
  ctkAusdPair: "0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae",
  whitelister: "0x7c10F56d6f04a51376393a1C3670e966863F6BD5",
} as const;

/** ERC-8004 registries on testnet (stretch goal). */
export const ERC8004 = {
  identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
} as const;

/**
 * Mera PRF salts. Each is a distinct namespace, so the keys derived from one passkey
 * cannot stand in for each other.
 *
 *  - `acct`   secp256k1 account; signs intents. (account work)
 *  - `notes`  secret-vault key; encrypts the family question and hold evidence. (non-account)
 *  - `duress` secp256k1 capability key; registered onchain as the freeze authority,
 *             holds no funds, so it is safe to surrender under coercion. (non-account)
 *
 * The salt must be exactly 32 bytes, which keccak256 guarantees.
 */
export const SALT_NAMESPACES = {
  acct: "thunai/acct",
  notes: "thunai/notes",
  duress: "thunai/duress",
} as const;

export type SaltNamespace = keyof typeof SALT_NAMESPACES;

/** Hold reason codes, mirrored from ThunaiVault.sol. */
export const HOLD_REASON = {
  NONE: 0,
  NEW_PAYEE: 1,
  OVER_CAP: 2,
  UNSCHEDULED: 3,
  NETWORK_FLAG: 4,
  CHECK_PENDING: 5,
  FROZEN: 6,
} as const;

export type HoldReason = (typeof HOLD_REASON)[keyof typeof HOLD_REASON];

export const HOLD_REASON_NAME: Record<number, string> = {
  0: "NONE",
  1: "NEW_PAYEE",
  2: "OVER_CAP",
  3: "UNSCHEDULED",
  4: "NETWORK_FLAG",
  5: "CHECK_PENDING",
  6: "FROZEN",
};

/** Hold lifecycle, mirrored from ThunaiVault.sol. */
export const HOLD_STATUS = {
  NONE: 0,
  OPEN: 1,
  RELEASED: 2,
  CANCELLED: 3,
  EXPIRED: 4,
} as const;

export const HOLD_STATUS_NAME: Record<number, string> = {
  0: "NONE",
  1: "OPEN",
  2: "RELEASED",
  3: "CANCELLED",
  4: "EXPIRED",
};

/**
 * Scam scripts the classifier may label. The classifier only labels and explains;
 * holds are opened by contract rules before it ever runs.
 */
export const SCAM_SCRIPT = {
  UNKNOWN: 0,
  FAKE_IMMIGRATION_OFFICER: 1,
  DIGITAL_ARREST: 2,
  VOICE_CLONE_ARREST: 3,
  JOB_TASK: 4,
  INVESTMENT: 5,
} as const;

export type ScamScriptId = (typeof SCAM_SCRIPT)[keyof typeof SCAM_SCRIPT];

export const SCAM_SCRIPT_NAME: Record<number, string> = {
  0: "UNKNOWN",
  1: "FAKE_IMMIGRATION_OFFICER",
  2: "DIGITAL_ARREST",
  3: "VOICE_CLONE_ARREST",
  4: "JOB_TASK",
  5: "INVESTMENT",
};

/** Dollars are 6-decimal, like the real AUSD. */
export const USD_DECIMALS = 6;

/** Defaults for a new family's envelope. */
export const ENVELOPE_DEFAULTS = {
  weeklyAmountUsd: 150,
  perWithdrawalCapUsd: 1000,
  cadenceSeconds: 7 * 24 * 60 * 60,
  holdTimeoutSeconds: 30 * 60,
} as const;

/** How long a `thunai/acct` signing session stays prompt-free before Face ID is asked again. */
export const SIGNING_SESSION_MS = 15 * 60 * 1000;

/** The WebAuthn relying party. Passkeys are scoped to this host. */
export const DEFAULT_RP_NAME = "Thunai";
