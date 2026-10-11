const faqs = [
  {
    q: "Is it a real mobile app?",
    a: "It runs in your phone's browser and installs to the home screen like an app. Sign-in uses a passkey (Face ID or fingerprint), which needs the browser for now. A native build is planned.",
  },
  {
    q: "Does Companion protect Arjun's bank account?",
    a: "Not directly, and no app can: a gift card or a Zelle transfer never touches Companion, and even banks cannot stop a transfer you are pressured into. Money from home stays in the app, and anything unusual is held for his parent. For everything else there is Silent SOS: one tap pauses his money, pages his parent and opens a private video call. Every one of these scams needs the victim isolated, however the scammer wants to be paid, and that is what the tap breaks.",
  },
  {
    q: "What if Kavya does not answer?",
    a: "The hold expires and the money returns to Arjun. It never goes to the payee.",
  },
  {
    q: "Does \"Check on Arjun\" prove he is safe?",
    a: "No. It proves it is really his phone in his hand right now. A passkey cannot be cloned, but a person can be pressured. The app says this on the result screen.",
  },
  {
    q: "Does a parent in India buy crypto?",
    a: "No. Parents never touch a token. On testnet a labelled stand-in plays the part of the licensed remittance partner that would deliver dollars in production.",
  },
  {
    q: "Who can move the money?",
    a: "No company can, including us. Spending needs Arjun's signature plus the contract's rules, and releasing anything held needs Kavya's passkey.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-24">
      <div className="mx-auto max-w-[820px] 2xl:max-w-[1000px] px-5 md:px-8 2xl:px-16">
        <h2 className="text-center font-grotesk text-[clamp(30px,4vw,46px)] font-extrabold tracking-[-0.025em]">Your <span className="font-accent text-brand-deep">questions</span></h2>
        <div className="mt-10 divide-y divide-line rounded-3xl border border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[16px] font-bold text-brand-ink transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
