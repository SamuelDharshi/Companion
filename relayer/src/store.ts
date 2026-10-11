import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Address } from "viem";

/**
 * The only state the server keeps.
 *
 * Mera's stateless promise is the constraint here: clearing a device and tapping Face ID
 * once must restore everything. So this file holds ONLY data that is already public or
 * already onchain — payee display names, which family a device belongs to, push endpoints.
 *
 * Never written here: a private key, a PRF output, a decrypted family question, or any
 * plaintext from `thunai/notes`. Those exist only on the family's own devices. If this
 * file leaked, an attacker would learn display names for addresses that are public anyway.
 */

export type PayeeRecord = {
  address: Address;
  name: string;
  /** On the guardian-signed schedule, so immune to network flags. */
  scheduled: boolean;
};

/**
 * A family part-way through onboarding.
 *
 * The student creates a passkey and invites the guardian, but nothing is registered
 * onchain until the guardian has accepted with her own Face ID. That ordering matters:
 * registering early would mean either a placeholder guardian key, or a contract function
 * that can swap the guardian's passkey later. Both are exactly what an attacker wants, so
 * neither exists. Until the guardian accepts, this record is the whole family, it holds
 * only public key material, and it controls no money.
 */
export type PendingFamily = {
  inviteCode: string;
  studentName: string;
  studentPasskey: { x: string; y: string };
  studentAcct: string;
  /** The STUDENT's duress key: he is the one who may be coerced. */
  duressAddr: string;
  createdAt: number;
  /** Set once registration succeeds, so the student's device can discover its family. */
  familyId?: string;
};

export type FamilyRecord = {
  familyId: string;
  /** Display names only. No contact details, nothing sensitive. */
  studentName: string;
  guardianName: string;
  payees: PayeeRecord[];
  createdAt: number;
  /** Invite token the guardian opens; consumed once accepted. */
  inviteCode?: string;
  inviteAccepted?: boolean;
  /**
   * The student's Silent SOS, if one has been raised. The room is a random, unguessable
   * video-call name that only the two family members are ever shown.
   */
  sos?: { at: number; room: string; demand?: string };
};

export type PushSubscription = {
  familyId: string;
  role: "student" | "guardian";
  /** Opaque Web Push subscription, or an Expo push token. */
  endpoint: string;
  keys?: { p256dh: string; auth: string };
  expoPushToken?: string;
};

type Shape = {
  families: Record<string, FamilyRecord>;
  /** Invite code to family id. */
  invites: Record<string, string>;
  /** Invite code to the family still waiting on a guardian. */
  pending: Record<string, PendingFamily>;
  subscriptions: PushSubscription[];
  /** Holds that already produced a reputation entry, so one save counts once. */
  feedbackGiven?: string[];
};

const EMPTY: Shape = { families: {}, invites: {}, pending: {}, subscriptions: [] };

export class Store {
  private data: Shape = structuredClone(EMPTY);
  private readonly file: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, "relayer-state.json");
    if (existsSync(this.file)) {
      try {
        this.data = { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(this.file, "utf8")) };
      } catch {
        // A corrupt file must not stop the relayer from booting mid-demo.
        this.data = structuredClone(EMPTY);
      }
    }
  }

  /** Atomic write, so a crash mid-save cannot leave a half-written file. */
  private flush() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.file);
  }

  putPending(record: PendingFamily) {
    this.data.pending[record.inviteCode] = record;
    this.flush();
  }

  getPending(inviteCode: string): PendingFamily | undefined {
    return this.data.pending[inviteCode];
  }

  /** Marks a pending family registered, so the student's device can find its id. */
  completePending(inviteCode: string, familyId: string) {
    const pending = this.data.pending[inviteCode];
    if (pending) pending.familyId = familyId;
    this.data.invites[inviteCode] = familyId;
    this.flush();
  }

  getFamily(familyId: string): FamilyRecord | undefined {
    return this.data.families[familyId];
  }

  listFamilies(): FamilyRecord[] {
    return Object.values(this.data.families);
  }

  upsertFamily(record: FamilyRecord) {
    this.data.families[record.familyId] = record;
    if (record.inviteCode) this.data.invites[record.inviteCode] = record.familyId;
    this.flush();
  }

  familyByInvite(code: string): FamilyRecord | undefined {
    const id = this.data.invites[code];
    return id ? this.data.families[id] : undefined;
  }

  acceptInvite(code: string): FamilyRecord | undefined {
    const family = this.familyByInvite(code);
    if (!family) return undefined;
    family.inviteAccepted = true;
    this.flush();
    return family;
  }

  /** Payees on the guardian-signed schedule, in a stable order so the root is reproducible. */
  scheduledPayees(familyId: string): Address[] {
    const family = this.getFamily(familyId);
    if (!family) return [];
    return family.payees
      .filter((p) => p.scheduled)
      .map((p) => p.address.toLowerCase() as Address)
      .sort();
  }

  addPayee(familyId: string, payee: PayeeRecord) {
    const family = this.getFamily(familyId);
    if (!family) throw new Error(`unknown family ${familyId}`);
    const existing = family.payees.findIndex(
      (p) => p.address.toLowerCase() === payee.address.toLowerCase(),
    );
    if (existing >= 0) family.payees[existing] = payee;
    else family.payees.push(payee);
    this.flush();
  }

  payeeName(familyId: string, address: Address): string | undefined {
    return this.getFamily(familyId)?.payees.find(
      (p) => p.address.toLowerCase() === address.toLowerCase(),
    )?.name;
  }

  feedbackDone(holdId: string): boolean {
    return (this.data.feedbackGiven ?? []).includes(holdId);
  }

  markFeedback(holdId: string) {
    this.data.feedbackGiven = [...(this.data.feedbackGiven ?? []), holdId];
    this.flush();
  }

  subscribe(sub: PushSubscription) {
    this.data.subscriptions = this.data.subscriptions.filter((s) => s.endpoint !== sub.endpoint);
    this.data.subscriptions.push(sub);
    this.flush();
  }

  subscriptionsFor(familyId: string, role?: "student" | "guardian"): PushSubscription[] {
    return this.data.subscriptions.filter(
      (s) => s.familyId === familyId && (role ? s.role === role : true),
    );
  }
}
