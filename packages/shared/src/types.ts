import type { Address, Hex } from "viem";

/** The two roles. Set at invite time and never changed: Arjun sets up, Amma only accepts. */
export type Role = "student" | "guardian";

/** A P256 passkey public key, captured from the attestation at registration. */
export type PasskeyPublicKey = { x: Hex; y: Hex };

/**
 * A WebAuthn assertion, shaped for Solady's `WebAuthn.WebAuthnAuth`.
 * `challengeIndex` and `typeIndex` are byte offsets into `clientDataJSON`.
 */
export type WebAuthnAuth = {
  authenticatorData: Hex;
  clientDataJSON: string;
  challengeIndex: bigint;
  typeIndex: bigint;
  r: Hex;
  s: Hex;
};

export type Envelope = {
  weeklyAmount: bigint;
  perWithdrawalCap: bigint;
  payeesRoot: Hex;
  cadence: bigint;
  holdTimeout: bigint;
  expiry: bigint;
  nextRunAt: bigint;
};

export type Family = {
  guardian: PasskeyPublicKey;
  student: PasskeyPublicKey;
  studentAcct: Address;
  guardianAcct: Address;
  duressAddr: Address;
  homeBalance: bigint;
  balance: bigint;
  frozen: boolean;
  checkNonce: bigint;
  checkRequestedAt: bigint;
  env: Envelope;
};

export type Hold = {
  familyId: bigint;
  to: Address;
  amount: bigint;
  reason: number;
  status: number;
  openedAt: bigint;
  releaseAt: bigint;
  memoHash: Hex;
};

export type WithdrawIntent = {
  familyId: bigint;
  to: Address;
  amount: bigint;
  memoHash: Hex;
  nonce: bigint;
  deadline: bigint;
};

/**
 * What the classifier returns. It labels and explains, in Tamil and English, and nothing
 * else: it never moves or releases money, and the hold is already open before it runs.
 */
export type Classification = {
  scriptId: number;
  confidence: number;
  explanation_en: string;
  explanation_ta: string;
  familyQuestionSuggested: string;
};

/** Input the agent assembles for the classifier. */
export type ClassifierInput = {
  memo: string;
  amountUsd: number;
  /** Multiple of the family's usual weekly allowance. */
  amountVsUsual: number;
  payeeIsNew: boolean;
  /** The student's local hour, 0-23. */
  localHour: number;
  networkFlagCount: number;
  /** Minutes the student says they have been on a call, when they share it. */
  callDurationMinutes?: number;
};

/** A payee shown by name. No addresses or crypto words ever reach the screen. */
export type Payee = {
  address: Address;
  name: string;
  scheduled: boolean;
};

export type DeploymentInfo = {
  chainId: number;
  thunaiVault: Address;
  scamSignals: Address;
  ctk: Address;
  ausd: Address;
  relayer: Address;
  agent: Address;
  agoraPair: Address;
  agoraEnabled: boolean;
  standInTokens: boolean;
};
