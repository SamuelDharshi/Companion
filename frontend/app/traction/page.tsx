import Navbar from "@/components/thunai/Navbar";
import Footer from "@/components/thunai/Footer";

// Re-read the chain's counts every 30 seconds, so a family drill shows up on its own.
export const revalidate = 30;

const RELAYER = process.env.RELAYER_URL || "http://localhost:8787";
// The Envio HyperIndex GraphQL endpoint. When set, the counters below are read from it; otherwise (or if it is
// unreachable) they come from the relayer, which counts the same contract events itself. The page says which.
const ENVIO = process.env.ENVIO_GRAPHQL_URL || "";
const EXPLORER = "https://testnet.monadexplorer.com";

type Traction = {
  network: string;
  vault: string;
  countedFromBlock: number;
  countedToBlock: number;
  families: { total: number; real: number; test: number; unknown?: number };
  holdsOpened: number;
  scamsStopped: number;
  holdsReleased: number;
  holdsExpired: number;
  dollarsProtected: string;
  medianSaveSeconds: number;
  fastestSaveSeconds: number;
  checksRequested: number;
  checksAnswered: number;
  reportsFiled: number;
  sosRaised: number;
  recent: { kind: string; block: number; tx: string; familyId?: string }[];
};

type Source = "Envio HyperIndex" | "the relayer's own count of the contracts' events";

const NETWORK_STATS = `query NetworkStats { NetworkStats(where: { id: { _eq: "global" } }) {
  holdsOpened scamsStopped holdsExpired dollarsProtected checksRequested checksAnswered reportsFiled sosRaised
  medianSaveSeconds fastestSaveSeconds } }`;

/** The headline counters from Envio, or undefined if it is not configured, not reachable, or has no row yet. */
async function loadEnvio(): Promise<Partial<Traction> | undefined> {
  if (!ENVIO) return undefined;
  try {
    const response = await fetch(ENVIO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: NETWORK_STATS }),
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { data?: { NetworkStats?: Record<string, unknown>[] }; errors?: unknown[] };
    const row = body.data?.NetworkStats?.[0];
    if (!row || body.errors?.length) return undefined;
    const n = (v: unknown) => Number(v ?? 0);
    return {
      holdsOpened: n(row.holdsOpened),
      scamsStopped: n(row.scamsStopped),
      holdsExpired: n(row.holdsExpired),
      dollarsProtected: String(row.dollarsProtected ?? "0"),
      checksRequested: n(row.checksRequested),
      checksAnswered: n(row.checksAnswered),
      reportsFiled: n(row.reportsFiled),
      sosRaised: n(row.sosRaised),
      medianSaveSeconds: n(row.medianSaveSeconds),
      fastestSaveSeconds: n(row.fastestSaveSeconds),
    };
  } catch {
    return undefined;
  }
}

async function load(): Promise<{ t: Traction; source: Source } | undefined> {
  try {
    const response = await fetch(`${RELAYER}/traction`, {
      headers: { "ngrok-skip-browser-warning": "true" },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return undefined;
    // The relayer alone knows which families are our own fictional test runs, so the real/test split and the recent
    // activity always come from it. The event counters come from Envio when it answers.
    const base = (await response.json()) as Traction;
    const envio = await loadEnvio();
    return envio ? { t: { ...base, ...envio }, source: "Envio HyperIndex" } : { t: base, source: "the relayer's own count of the contracts' events" };
  } catch {
    return undefined;
  }
}

const dollars = (units: string) => `$${(Number(units) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const labels: Record<string, string> = {
  family_registered: "A family registered",
  hold_opened: "A payment was held",
  hold_stopped: "A parent stopped a payment",
  hold_released: "A parent allowed a payment",
  hold_expired: "A hold timed out and the money returned",
  payout: "An allowance was settled",
  check_answered: "A student answered a check",
  sos_raised: "A student pressed Silent SOS",
  payee_reported: "A payee was reported to the network",
};

function Stat({ value, label, note }: { value: string | number; label: string; note?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-6">
      <p className="font-grotesk text-[44px] font-extrabold leading-none tracking-tight">{value}</p>
      <p className="mt-2 text-[15px] font-semibold">{label}</p>
      {note ? <p className="mt-1 text-[13px] text-ink-muted">{note}</p> : null}
    </div>
  );
}

export default async function TractionPage() {
  const loaded = await load();
  const t = loaded?.t;
  const source = loaded?.source;

  return (
    <main className="flex w-full flex-col bg-white pt-[64px]">
      <Navbar />
      <section className="bg-gradient-to-b from-brand-tint to-white">
        <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-16 md:px-8 2xl:px-16">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-deep">Traction</p>
          <h1 className="mt-3 font-grotesk text-[clamp(34px,5vw,64px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            What has really happened, <span className="font-accent text-brand-deep">on the chain</span>
          </h1>
          <p className="mt-5 max-w-[680px] text-[18px] leading-relaxed text-ink-muted">
            Every number below is a count of an event our contracts emitted on Monad testnet. Nothing is typed in.
            Families who try the app, including the drills we are running, show up here by themselves.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-5 pb-20 md:px-8 2xl:px-16">
        {!t ? (
          <p className="rounded-3xl border border-line p-8 text-[16px] text-ink-muted">
            The live counter could not be reached just now, so no numbers are shown rather than old ones.
          </p>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Stat value={t.families.real} label="Real families" note="Families who signed up themselves." />
              <Stat value={t.scamsStopped} label="Payments stopped by a parent" />
              <Stat
                value={t.medianSaveSeconds ? `${t.medianSaveSeconds}s` : "—"}
                label="Median time to stop one"
                note="From the payment being held to the parent's decision."
              />
              <Stat value={t.sosRaised} label="Silent SOS presses" />
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Stat value={t.holdsOpened} label="Payments held" />
              <Stat value={t.holdsExpired} label="Returned because nobody answered" />
              <Stat value={dollars(t.dollarsProtected)} label="Test dollars protected" note="Stand-in tokens, no real value." />
              <Stat value={`${t.checksAnswered} of ${t.checksRequested}`} label="Checks answered by the student" />
            </div>

            <div className="mt-8 rounded-3xl bg-brand-tint p-6 text-[15px] leading-relaxed text-ink-muted">
              <b className="text-ink">How to read this honestly.</b> Of {t.families.total} families on this deployment,{" "}
              {t.families.real} signed up themselves, {t.families.test} are our own automated test runs (the fictional Arjun
              and Kavya)
              {t.families.unknown
                ? `, and ${t.families.unknown} we cannot classify because our server's records were reset (most are our own tests)`
                : ""}
              . Only families we can see signed up themselves count as &quot;Real families&quot;; tests and unknowns are
              counted in the activity below but never there. Counted
              from block {t.countedFromBlock.toLocaleString("en-US")} to {t.countedToBlock.toLocaleString("en-US")} on {t.network}.
              {" "}Event counters are read from <b className="text-ink">{source}</b>; the split between real and test families comes
              from our relayer, which knows which families are the fictional ones.
            </div>

            <h2 className="mt-14 font-grotesk text-[28px] font-extrabold tracking-tight">Latest activity</h2>
            {t.recent.length === 0 ? (
              <p className="mt-4 text-ink-muted">Nothing yet.</p>
            ) : (
              <ul className="mt-5 divide-y divide-line rounded-3xl border border-line">
                {t.recent.map((e) => (
                  <li key={`${e.tx}-${e.kind}-${e.block}`} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 text-[15px]">
                    <span className="font-semibold">{labels[e.kind] ?? e.kind}</span>
                    <a
                      href={`${EXPLORER}/tx/${e.tx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-ibm-mono text-[13px] text-brand-deep hover:underline"
                    >
                      block {e.block.toLocaleString("en-US")} · {e.tx.slice(0, 10)}…{e.tx.slice(-6)} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      <Footer />
    </main>
  );
}
