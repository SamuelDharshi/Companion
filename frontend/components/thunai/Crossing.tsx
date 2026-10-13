import GlobeLazy from "./GlobeLazy";

/**
 * The allowance crossing the border: a 3D globe with the route from Chennai to Bloomington, and the three facts that matter
 * beside it. The figures are the measured ones in docs/STATUS.md; nothing here is typed in for effect.
 */
export default function Crossing() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto grid max-w-[1680px] items-center gap-10 px-5 py-20 md:px-8 lg:grid-cols-[1.1fr_1fr] 2xl:px-16 2xl:py-28">
        <div className="relative mx-auto aspect-square w-full max-w-[620px]">
          <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(0,255,34,0.16),transparent_65%)]" />
          <GlobeLazy className="absolute inset-0 h-full w-full" />
        </div>

        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-deep">Across the border</p>
          <h2 className="mt-3 font-grotesk text-[clamp(32px,4.4vw,64px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            Chennai to Indiana in <span className="font-accent text-brand-deep">about a second</span>
          </h2>
          <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-ink-muted">
            The weekly allowance settles through Agora&apos;s Instant Settlement on Monad, in the same transaction that moves it.
            A bank transfer takes one to three business days.
          </p>

          <dl className="mt-9 grid max-w-[560px] gap-4 sm:grid-cols-3">
            {[
              { k: "0.50 s", v: "median confirmation, measured on Monad testnet" },
              { k: "1 Face ID", v: "for the parent to stop a payment, checked inside the contract" },
              { k: "0", v: "dollars that reach a new payee before the parent decides" },
            ].map((f) => (
              <div key={f.k} className="rounded-2xl border border-line bg-white p-5">
                <dt className="font-grotesk text-[28px] font-extrabold leading-none tracking-tight text-ink">{f.k}</dt>
                <dd className="mt-2 text-[13px] leading-snug text-ink-muted">{f.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-ink-faint">Testnet: the money is Agora&apos;s testnet tokens and has no real value.</p>
        </div>
      </div>
    </section>
  );
}
