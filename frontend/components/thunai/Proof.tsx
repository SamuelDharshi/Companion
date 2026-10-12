import { demo, kindLabel, recordedOn, seconds, short, txUrl } from "@/lib/demo";

/**
 * The receipts. Every row is a real transaction from the recorded run, with a link to the
 * explorer, so nothing on this page has to be taken on trust.
 */
export default function Proof() {
  const rows = demo.steps.filter((s) => s.txHash);
  const keeper = demo.steps.find((s) => s.kind === "allowance_run");

  return (
    <section id="proof" className="scroll-mt-20 bg-white py-24">
      <div className="mx-auto max-w-[1680px] px-5 md:px-8 2xl:px-16">
        <div className="max-w-[760px]">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-deep">Verify it yourself</p>
          <h2 className="mt-3 font-grotesk text-[clamp(30px,4vw,56px)] font-extrabold leading-[1.05] tracking-[-0.025em]">
            No mock-ups. <span className="font-accent text-brand-deep">Real transactions.</span>
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-muted">
            A fictional family ({demo.student.name} and {demo.guardian.name}) played the whole scene on {demo.network} on{" "}
            {recordedOn}. The figures come from the relayer's record of that run, and each transaction is on the chain. Open any of them and check the numbers on the phones above.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-line">
          <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_1fr] gap-4 bg-brand-tint px-6 py-3 text-[12px] font-bold uppercase tracking-wide text-ink-muted md:grid">
            <span>What happened</span>
            <span>Transaction</span>
            <span>Confirmed in</span>
            <span>Result</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li
                key={s.txHash}
                className="grid gap-1 px-6 py-4 text-[15px] md:grid-cols-[1.6fr_1fr_0.7fr_1fr] md:items-center md:gap-4"
              >
                <span className="font-semibold">{kindLabel[s.kind] ?? s.kind}</span>
                <a
                  href={txUrl(s.txHash!)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-ibm-mono text-[13px] text-brand-deep underline-offset-4 hover:underline"
                >
                  {short(s.txHash!)} ↗
                </a>
                <span className="font-ibm-mono text-[13px] text-ink-muted">{seconds(s.latencyMs)}</span>
                <span className="text-[14px] text-ink-muted">
                  {s.amount !== undefined ? `$${s.amount}` : ""}
                  {s.balanceAfter ? ` · balance ${s.balanceAfter}` : ""}
                </span>
              </li>
            ))}
            {keeper ? (
              <li className="grid gap-1 px-6 py-4 text-[15px] md:grid-cols-[1.6fr_1fr_0.7fr_1fr] md:items-center md:gap-4">
                <span className="font-semibold">{kindLabel[keeper.kind]}</span>
                <span className="font-ibm-mono text-[13px] text-ink-faint">sent by the keeper</span>
                <span />
                <span className="text-[14px] text-ink-muted">
                  balance {keeper.balanceBefore} → {keeper.balanceAfter}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="mt-6 grid gap-4 text-[14px] text-ink-muted md:grid-cols-3">
          <p>
            <b className="text-ink">Contract:</b>{" "}
            <a
              className="font-ibm-mono text-brand-deep hover:underline"
              href={`${demo.explorer}/address/${demo.vault}`}
              target="_blank"
              rel="noreferrer"
            >
              {short(demo.vault)} ↗
            </a>
          </p>
          <p>
            <b className="text-ink">Confirmation times</b> are how long the relayer waited for each receipt, measured in the
            run.
          </p>
          <p>
            <b className="text-ink">Testnet only.</b> Testnet tokens carry no real value.
          </p>
        </div>
      </div>
    </section>
  );
}
