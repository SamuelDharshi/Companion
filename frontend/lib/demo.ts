import raw from "@/data/demo.json";

/**
 * The one source of numbers and names on this page.
 *
 * `data/demo.json` is written by `scripts/seed-demo.mjs`, which plays the whole scene on
 * Monad testnet and records what the chain and the services actually returned. Nothing
 * below is typed in by hand: change the recording and the page changes with it.
 */
export type DemoStep = {
  at: string;
  kind: string;
  txHash?: string;
  latencyMs?: number;
  amount?: number;
  to?: string;
  reason?: string;
  holdId?: string;
  status?: string;
  balanceBefore?: string;
  balanceAfter?: string;
  balanceWhileHeld?: string;
};

type Demo = {
  generatedAt: string;
  network: string;
  chainId: number;
  explorer: string;
  vault: string;
  scamSignals: string;
  familyId: string;
  student: { name: string; account: string };
  guardian: { name: string; account: string };
  final: { balanceLabel: string; homeBalanceLabel: string; weeklyAmount: number; openHolds: number };
  hold: { id: string; amountLabel: string; reasonName: string; statusAfter: string; memo: string };
  brief: {
    scriptId: number | null;
    source: string | null;
    explanation: string | null;
    alertTitle: string | null;
    alertBody: string | null;
  } | null;
  steps: DemoStep[];
};

export const demo = raw as unknown as Demo;

const step = (kind: string) => demo.steps.find((s) => s.kind === kind);
export const steps = {
  registered: step("family_registered"),
  envelope: step("envelope_set"),
  allowance: step("allowance_run"),
  deposited: step("funded_home"),
  settled: step("funded_settled"),
  rent: step("rent_paid"),
  held: step("hold_opened"),
  stopped: step("hold_stopped"),
  checked: step("check_proved"),
  reported: step("payee_reported"),
};

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
export const seconds = (ms?: number) => (ms === undefined ? "—" : `${(ms / 1000).toFixed(1)}s`);

export const txUrl = (hash: string) => `${demo.explorer}/tx/${hash}`;
export const short = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

/** Whole seconds between two recorded steps, e.g. how long a hold stood before it was stopped. */
export function secondsBetween(a?: DemoStep, b?: DemoStep) {
  if (!a || !b) return undefined;
  return Math.round((Date.parse(b.at) - Date.parse(a.at)) / 1000);
}

/** The next weekly run: one week after the recorded one, in UTC so it never drifts by locale. */
export const nextAllowance = (() => {
  const when = new Date(Date.parse(steps.allowance?.at ?? demo.generatedAt) + 7 * 86400_000);
  return when.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
})();

export const recordedOn = new Date(demo.generatedAt).toLocaleString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const SCRIPT_NAMES: Record<number, string> = {
  0: "unusual request",
  1: "fake officer scam",
  2: "digital arrest scam",
  3: "cloned voice scam",
  4: "fake job scam",
  5: "fake investment scam",
};
export const scriptName = SCRIPT_NAMES[demo.brief?.scriptId ?? 0] ?? "unusual request";

export const HOLD_TIMEOUT_MINUTES = 30; // the holdTimeout (1800s) the demo envelope was signed with

export const kindLabel: Record<string, string> = {
  family_registered: "Family registered, one passkey each",
  envelope_set: "Weekly allowance signed",
  funded_home: "Money from home deposited",
  allowance_run: "Weekly allowance settled",
  funded_settled: "Extra money settled in the same transaction",
  rent_paid: "Rent paid, on the signed schedule",
  hold_opened: "Payment to a new person held",
  hold_stopped: "Held payment stopped with Face ID",
  check_requested: "Check on Arjun requested",
  check_proved: "Arjun's passkey answered the check",
  payee_reported: "Payee reported to other families",
};
