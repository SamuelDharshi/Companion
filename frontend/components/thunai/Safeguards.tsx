const items = [
  {
    t: "Allowance on autopilot",
    d: "Kavya signs one envelope. The agent settles it every week with nobody touching the app.",
  },
  {
    t: "A cooling hold, not a block",
    d: "New person, unusual amount or a flagged number? The money waits. Nothing is ever pulled back from anyone.",
  },
  {
    t: "Rules decide, then explain",
    d: "The hold comes from fixed rules. The same rules name the pattern and explain it in plain words, and a language model can write that explanation when it is switched on. Nothing but the family's passkeys can move or release money.",
  },
  {
    t: "Breaks the isolation",
    d: "Scams work by keeping the student alone on the phone. Companion pages the parent the moment a payment is held, so he is no longer alone.",
  },
  {
    t: "Silent SOS, for money outside the app",
    d: "One discreet tap on the student's phone pauses their money, pages the parent and opens a private video call. It works for gift cards, Zelle and wires too, because it breaks the isolation the scam depends on, not the payment.",
  },
  {
    t: "Fails safe",
    d: "If nobody answers, anyone can expire the hold and the money returns to the student. A keeper does it automatically.",
  },
  {
    t: "Learns as a network",
    d: "When a family confirms a scam, other families see a raised hold level for that number. Reports raise a hold. They never block on their own.",
  },
];

export default function Safeguards() {
  return (
    <section id="safeguards" className="scroll-mt-20 bg-brand-tint py-24">
      <div className="mx-auto max-w-[1680px] px-5 md:px-8 2xl:px-16">
        <div className="max-w-[640px]">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-deep">Safeguards</p>
          <h2 className="mt-3 font-grotesk text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.05] tracking-[-0.025em]">
            What happens <span className="font-accent text-brand-deep">behind the screen</span>
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:gap-8">
          {items.map((it, i) => (
            <div key={it.t} className="rounded-3xl border border-line bg-white p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand font-ibm-mono text-[14px] font-bold text-brand-ink">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-grotesk text-[20px] font-bold">{it.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted 2xl:text-[17px]">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
