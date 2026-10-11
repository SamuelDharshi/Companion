import { Platform } from "react-native";
import {
  ENVELOPE_DEFAULTS,
  decryptNotes,
  encryptNotes,
  toUnits,
  type FamilyNotes,
  type Role,
} from "@thunai/shared";
import { api } from "@/api/client";
import {
  deriveNotesKey,
  createThunaiAccount,
  restoreThunaiAccount,
  signActionHash,
  type ThunaiAccount,
} from "@/mera/account";
import { setDeviceState, getDeviceState } from "@/state/store";
import { BASE_PATH, rpId } from "@/config";

/**
 * Onboarding, both roles.
 *
 * The shape of it is the product: Arjun sets everything up, and Kavya only ever accepts.
 * She does one Face ID and is never asked to configure anything, because a parent who has
 * to be walked through a setup flow is a parent who never finishes it.
 */

/**
 * The student creates his passkey and gets an invite link.
 *
 * Nothing is registered onchain yet, on purpose. The family is created only when the
 * guardian accepts with her own Face ID, so the guardian slot never holds a placeholder
 * and the contract needs no function that can swap a passkey afterwards. The cost is that
 * the student sees a "waiting for Kavya" screen for a minute, which is honest: until she
 * accepts, there is no guardian and so no protection to show.
 */
export async function startAsStudent(displayName: string): Promise<{
  account: ThunaiAccount;
  inviteCode: string;
  inviteUrl: string;
}> {
  const { account } = await createThunaiAccount({
    rpId: rpId(),
    role: "student",
    displayName,
  });

  const { inviteCode } = await api.onboardStudent({
    studentPasskey: account.passkey,
    studentAcct: account.address,
    duressAddr: account.duressAddress,
    studentName: displayName,
  });

  await setDeviceState({
    role: "student",
    inviteCode,
    credential: account.credential,
    address: account.address,
    duressAddress: account.duressAddress,
    onboardedAt: Date.now(),
  });

  return { account, inviteCode, inviteUrl: inviteUrl(inviteCode) };
}

/**
 * Polled by the student's phone while it waits.
 *
 * Returns the family id the moment the guardian has accepted, which is also the moment
 * the family exists onchain.
 */
export async function pollForGuardian(inviteCode: string): Promise<string | undefined> {
  const invite = await api.invite(inviteCode);
  if (!invite.familyId) return undefined;
  await setDeviceState({ familyId: invite.familyId });
  return invite.familyId;
}

/** The link that goes into WhatsApp. Opens straight onto Kavya's accept screen. */
export function inviteUrl(code: string): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}${BASE_PATH}/onboard/accept?code=${code}`;
  }
  return `https://thunai.app/onboard/accept?code=${code}`;
}

export function whatsAppInvite(code: string, studentName: string): string {
  const text =
    `${studentName} added you as his Companion, so you get asked before any ` +
    `unusual payment leaves his account.\n\nTap here, then Face ID. That's all:\n${inviteUrl(code)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * The guardian accepts. One Face ID, and nothing else.
 *
 * Her real passkey public key replaces the placeholder, so from this point only her
 * Face ID can release a held payment.
 */
export async function acceptAsGuardian(
  code: string,
  displayName: string,
): Promise<{ account: ThunaiAccount; familyId: string; studentName: string }> {
  const invite = await api.invite(code);

  const { account } = await createThunaiAccount({
    rpId: rpId(),
    role: "guardian",
    displayName,
  });

  // This is the call that creates the family onchain, with two real passkeys.
  const registered = await api.onboardGuardian({
    inviteCode: code,
    guardianPasskey: account.passkey,
    guardianAcct: account.address,
    guardianName: displayName,
  });

  await setDeviceState({
    role: "guardian",
    familyId: registered.familyId,
    credential: account.credential,
    address: account.address,
    duressAddress: account.duressAddress,
    onboardedAt: Date.now(),
  });

  return { account, familyId: registered.familyId, studentName: invite.studentName };
}

/**
 * The guardian signs the weekly envelope once.
 *
 * This is the only configuration in the product, and it is deliberately one sentence:
 * "Every week $X, anything over the cap or to anyone new asks me first." The signature is
 * verified onchain at the P256 precompile, so the rules it sets cannot be changed by a
 * server, by us, or by anyone holding Arjun's phone.
 */
export async function signEnvelope(options: {
  familyId: string;
  weeklyUsd: number;
  capUsd: number;
  /** Seconds. Defaults to the PRD's 30 minutes. */
  holdTimeoutSeconds?: number;
  firstRunAt?: Date;
}): Promise<{ latencyMs: number }> {
  const { payeesRoot } = await api.payees(options.familyId);

  const nextRunAt = BigInt(
    Math.floor((options.firstRunAt?.getTime() ?? Date.now()) / 1000),
  );
  const envelope = {
    weeklyAmount: toUnits(options.weeklyUsd),
    perWithdrawalCap: toUnits(options.capUsd),
    payeesRoot,
    cadence: BigInt(ENVELOPE_DEFAULTS.cadenceSeconds),
    holdTimeout: BigInt(options.holdTimeoutSeconds ?? ENVELOPE_DEFAULTS.holdTimeoutSeconds),
    // A year out: an envelope that never expires is a rule nobody ever revisits.
    expiry: BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60),
    nextRunAt,
  };

  const { challenge } = await api.envelopeChallenge({
    familyId: options.familyId,
    envelope: stringifyEnvelope(envelope),
  });

  const auth = await signActionHash({
    rpId: rpId(),
    actionHash: challenge,
    credential: getDeviceState().credential,
  });

  const result = await api.setEnvelope({
    familyId: options.familyId,
    envelope: stringifyEnvelope(envelope),
    auth,
  });

  await setDeviceState({ envelopeSet: true });
  return { latencyMs: result.latencyMs };
}

function stringifyEnvelope(envelope: Record<string, bigint | string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(envelope).map(([key, value]) => [key, value.toString()]),
  );
}

const roleNumber = (role: Role): 0 | 1 => (role === "guardian" ? 1 : 0);

/**
 * Records a private note, such as the question only the real family could answer.
 *
 * It is encrypted on this device with a key derived from this person's passkey and then stored
 * in the vault contract as ciphertext. Nobody else can read it, we cannot read it, and it does
 * not live on this device: after "Forget this device" one Face ID brings it back, on this phone
 * or any other that has the same passkey. Two prompts, because deriving the key and authorising
 * the write are two different things.
 */
export async function recordFamilyQuestion(question: string, answerHint?: string): Promise<void> {
  const device = getDeviceState();
  if (!device.familyId || !device.role) throw new Error("This device is not part of a family yet.");
  const role = roleNumber(device.role);

  const key = await deriveNotesKey({ rpId: rpId(), credential: device.credential });

  // Keep whatever else was already in the notes (such as hold notes) when adding to them.
  const current = await api.notes(device.familyId, role);
  const existing =
    current.ciphertext && current.ciphertext !== "0x" ? await decryptNotes(key, current.ciphertext) : {};
  const ciphertext = await encryptNotes(key, {
    ...existing,
    familyQuestion: question,
    familyAnswerHint: answerHint,
  });

  const { challenge } = await api.notesChallenge({ familyId: device.familyId, role, ciphertext });
  const auth = await signActionHash({ rpId: rpId(), actionHash: challenge, credential: device.credential });
  await api.setNotes({ familyId: device.familyId, role, ciphertext, auth });
}

/**
 * Reads this person's notes back from the chain and decrypts them. One Face ID, and nothing
 * stored on the device is needed: the family comes from the passkey, the ciphertext from the
 * contract and the key from the passkey's PRF output.
 */
export async function loadFamilyNotes(): Promise<FamilyNotes | undefined> {
  const device = getDeviceState();
  if (!device.familyId || !device.role) throw new Error("This device is not part of a family yet.");
  const stored = await api.notes(device.familyId, roleNumber(device.role));
  if (!stored.ciphertext || stored.ciphertext === "0x") return undefined;
  const key = await deriveNotesKey({ rpId: rpId(), credential: device.credential });
  return decryptNotes(key, stored.ciphertext);
}

/**
 * The stateless restore, as the app uses it.
 *
 * One Face ID gives back the same addresses; the chain gives back which family they
 * belong to. Nothing was read from storage, which is the whole point of the test.
 */
export async function restoreFromPasskey(role: Role): Promise<{ familyId: string } | undefined> {
  const { account } = await restoreThunaiAccount({ rpId: rpId(), role });
  const found = await api.familyByAccount(account.address);
  if (!found.familyId) return undefined;

  await setDeviceState({
    role: found.role ?? role,
    familyId: found.familyId,
    address: account.address,
    duressAddress: account.duressAddress,
    credential: account.credential,
  });
  return { familyId: found.familyId };
}
