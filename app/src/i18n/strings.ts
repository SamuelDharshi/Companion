/**
 * Copy, in English.
 *
 * Two rules enforced by review, not by code:
 *   1. No crypto words, ever. No wallet, token, gas, address, hash, AUSD or chain.
 *   2. Amounts are dollars, payees are names.
 */

/** English only. The type stays so call sites keep compiling, and any saved "ta" is ignored. */
export type Lang = "en";

type Entry = { en: string };

export const strings = {
  // ----------------------------------------------------------- shared
  appName: { en: "Companion" },
  tagline: { en: "Family is your second key" },
  continue: { en: "Continue" },
  cancel: { en: "Cancel" },
  back: { en: "Back" },
  done: { en: "Done" },
  details: { en: "Details" },
  retry: { en: "Try again" },
  loading: { en: "One moment…" },
  faceId: { en: "Face ID" },
  tapFaceIdToContinue: { en: "Tap Face ID to continue" },

  // ------------------------------------------------------- onboarding
  welcomeTitle: {
    en: "Money from home, with family watching",
  },
  welcomeBody: {
    en: "Your allowance arrives in about a second. Anything unusual pauses until your family says yes.",
  },
  createWithFaceId: { en: "Create with Face ID" },
  iAmStudent: { en: "I'm the student" },
  iAmGuardian: { en: "I'm the parent" },
  yourName: { en: "Your name" },

  inviteGuardianTitle: { en: "Invite Kavya as your Companion" },
  inviteGuardianBody: {
    en: "She approves anything unusual. She never has to set anything up.",
  },
  shareOnWhatsApp: { en: "Share on WhatsApp" },
  copyInviteLink: { en: "Copy invite link" },
  waitingForGuardian: { en: "Waiting for Kavya to accept…" },

  acceptInviteTitle: { en: "{name} wants you as his Companion" },
  acceptInviteBody: {
    en: "One tap. You'll be asked before any unusual payment leaves.",
  },
  acceptWithFaceId: { en: "Accept with Face ID" },

  // --------------------------------------------------------- envelope
  envelopeTitle: { en: "Set the weekly allowance" },
  envelopeSummary: {
    en: "Every week {weekly} · Anything over {cap}, or to anyone new, asks me first",
  },
  envelopeSign: { en: "Approve once with Face ID" },
  weeklyAmount: { en: "Every week" },
  askMeAbove: { en: "Ask me above" },

  // ------------------------------------------------- student home
  balance: { en: "Available" },
  nextFromGuardian: { en: "Next from Kavya: {when} {amount}" },
  rentAutoPays: { en: "Rent auto-pays {when}" },
  guardianIsYourThunai: { en: "{name} is your Companion" },
  activity: { en: "Activity" },
  noActivityYet: { en: "Nothing yet. Your first allowance will show up here." },
  sendMoney: { en: "Send" },

  arrivedFromGuardian: { en: "{when} {amount} from {name} arrived" },
  paidAutomatically: { en: "Paid automatically" },
  swiftComparison: { en: "A bank transfer takes 2–3 business days" },

  // -------------------------------------------------------- sending
  sendTitle: { en: "Send money" },
  toWhom: { en: "To" },
  payeeName: { en: "Their name" },
  amount: { en: "Amount" },
  whatsThisFor: { en: "What's this for?" },
  whatsThisForHint: {
    en: "In your own words. Kavya sees this if we need to ask her.",
  },
  whatsThisForRequired: { en: "Please tell us what this is for." },
  onACall: { en: "Are you on a call right now?" },
  onACallHint: {
    en: "Optional. It helps Kavya understand what's happening.",
  },
  sendNow: { en: "Send" },
  sent: { en: "Sent" },

  // ----------------------------------------------------------- hold
  heldForSafety: { en: "Held for safety: {amount}" },
  heldWeAskedGuardian: { en: "We've asked Kavya." },
  heldNewPayee: { en: "This is a new payee and an urgent request." },
  heldOverCap: { en: "This is more than the limit Kavya set." },
  heldNetworkFlag: {
    en: "Another Companion family has reported this payee.",
  },
  heldCheckPending: {
    en: "Kavya is checking on you right now.",
  },
  heldFrozen: { en: "Your family has paused everything." },
  realOfficersNever: {
    en: "Real officers never ask for payment by phone, gift card or transfer.",
  },
  guardianReviewing: { en: "Kavya is reviewing…" },
  moneyComesBackAutomatically: {
    en: "If no one answers, your money comes back automatically.",
  },
  familiesReportedThis: {
    en: "{count} verified family reported this number, {ago}.",
  },
  guardianStoppedThis: { en: "Kavya stopped this. {amount} is back." },
  guardianAllowedThis: { en: "Kavya approved this." },
  noOneAnswered: { en: "No one answered, so your money is back." },

  // ------------------------------------------------- guardian screens
  allGood: { en: "All good" },
  allGoodSub: { en: "{name} is fine. Nothing is waiting for you." },
  lastAllowanceSent: { en: "Last sent {when}: {amount}" },
  checkOnStudent: { en: "Check on {name}" },
  sendMoneyNow: { en: "Send money now" },

  studentNeedsYou: { en: "{name} needs you" },
  tryingToSend: {
    en: "{name} is trying to send {amount} to a new person for \"{memo}\".",
  },
  looksLikeScam: { en: "This looks like the {script}." },
  onCallForMinutes: { en: "{name} has been on a call for {minutes} minutes." },
  stopIt: { en: "Stop it" },
  allowIt: { en: "Allow" },
  notSureStopIt: {
    en: "Not sure? Stop it. {name} gets his money back.",
  },

  // ---------------------------------------------------- check / liveness
  checkingOnStudent: { en: "Checking on {name}…" },
  signedOnTheirPhone: {
    en: "Signed on {name}'s phone, {ago}",
  },
  provesItsReallyThem: {
    en: "This proves it's really {name}'s phone in his hands. A voice on a call can't fake this.",
  },
  doesNotProveSafe: {
    en: "It doesn't prove he's safe. Call him on video too.",
  },
  noReplyYet: {
    en: "No reply yet. Any payment from you to someone new will be held.",
  },
  checkRequestTitle: { en: "Kavya is checking on you" },
  checkRequestBody: {
    en: "Tap Face ID to show it's really you.",
  },
  imNotSafe: { en: "I can't talk freely" },

  // --------------------------------------------------------- network
  reportThisPayee: { en: "Tell other families" },
  reportThisPayeeBody: {
    en: "Your report raises the warning for every other Companion family. It never blocks anyone on its own.",
  },
  reportSent: { en: "Thank you. Other families are safer now." },
  familiesProtected: { en: "Families protected" },

  // ---------------------------------------------------------- details
  signedBy: { en: "Signed by {name}" },
  receiptNumber: { en: "Receipt" },
  settledIn: { en: "Settled in {latency}" },
  sessionActive: { en: "Session active · {minutes} min" },
  viewOnExplorer: { en: "View the receipt" },
  language: { en: "Language" },
  everythingRestored: { en: "Everything is back." },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof strings;

/** Looks up a string and fills `{placeholders}`. English is the default. */
export function t(
  key: StringKey,
  lang: Lang = "en",
  vars: Record<string, string | number> = {},
): string {
  const entry = strings[key] as Entry;
  let value = entry.en;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

/** The scam script names, as a family should hear them. */
export const scriptNames: Record<number, Entry> = {
  0: { en: "unusual request" },
  1: { en: "fake officer scam" },
  2: { en: "digital arrest scam" },
  3: { en: "cloned voice scam" },
  4: { en: "fake job scam" },
  5: { en: "fake investment scam" },
};

export function scriptName(scriptId: number, lang: Lang = "en"): string {
  const entry = scriptNames[scriptId] ?? scriptNames[0]!;
  return entry.en;
}
