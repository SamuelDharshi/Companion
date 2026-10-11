import type { ReactNode } from "react";
import { APP_URL, appLinkProps } from "@/lib/app";
import { AcceptInvite, CheckResult, GuardianAlert, HeldForSafety, SendMoney, StoppedResult, StudentHome } from "./Screens";
import { demo, seconds, steps as run, usd } from "@/lib/demo";

type Step = {
  n: string;
  who: "Student" | "Parent" | "Both";
  title: string;
  body: string;
  points: string[];
  screens: ReactNode;
};

const steps: Step[] = [
  {
    n: "01",
    who: "Both",
    title: "Set up in one Face ID each",
    body: `${demo.student.name} creates his account and invites ${demo.guardian.name} on WhatsApp. She opens the link and accepts. She never has to configure anything.`,
    points: [
      "One passkey per person: no password, no recovery phrase, no email, no OTP.",
      `${demo.guardian.name} signs the weekly allowance once: ${usd(demo.final.weeklyAmount)} a week, with rent on the signed schedule.`,
      `${demo.student.name} can only pay people already on that signed schedule without a pause.`,
    ],
    screens: <AcceptInvite />,
  },
  {
    n: "02",
    who: "Student",
    title: "The allowance arrives by itself",
    body: `Every week the allowance settles in about a second (${seconds(run.settled?.latencyMs)} in the recorded run) and shows up on ${demo.student.name}'s home screen. Rent pays itself.`,
    points: [
      "Balance in dollars, next allowance and rent status on one screen.",
      "Recipients are names, never account numbers or addresses.",
      "No pending state: when it says sent, it is sent.",
    ],
    screens: <StudentHome />,
  },
  {
    n: "03",
    who: "Student",
    title: "Anything unusual pauses first",
    body: `A new person, an unusual amount or a flagged number opens a hold. The money has not left. In the recorded run, a ${demo.hold.amountLabel} payment to a new person was held in ${seconds(run.held?.latencyMs)}.`,
    points: [
      "He must say what the payment is for before it is sent.",
      "The hold names the pattern it resembles and says why, in plain words.",
      `If nobody answers, the money returns to ${demo.student.name}. Never to the payee.`,
    ],
    screens: (
      <div className="flex flex-col items-center gap-6 xl:flex-row">
        <SendMoney />
        <HeldForSafety />
      </div>
    ),
  },
  {
    n: "04",
    who: "Parent",
    title: "She decides, with her own Face ID",
    body: `${demo.guardian.name} gets an alert with the amount and the reason, then taps Stop it or Allow. In the recorded run her stop was confirmed in ${seconds(run.stopped?.latencyMs)} and the balance went from ${run.stopped?.balanceWhileHeld} back to ${run.stopped?.balanceAfter}.`,
    points: [
      "The decision is verified inside the contract on Monad. No server, no company and no scammer can override her.",
      `Stopping returns the money to ${demo.student.name} at once.`,
      `Once ${demo.student.name} is not alone on the call, the scammer's pressure stops working.`,
    ],
    screens: (
      <div className="flex flex-col items-center gap-6 xl:flex-row">
        <GuardianAlert />
        <StoppedResult />
      </div>
    ),
  },
  {
    n: "05",
    who: "Parent",
    title: `Check on ${demo.student.name}, any time`,
    body: `A cloned voice can say anything. A passkey cannot be cloned. One tap asks ${demo.student.name}'s phone to answer with his own passkey. In the recorded run it was verified onchain in ${seconds(run.checked?.latencyMs)}.`,
    points: [
      "Proves it is really his phone, in his hand, right now.",
      "Does not prove he is safe. The app says so, and suggests a video call.",
      "He also has a quiet \"I can't talk freely\" option that freezes outgoing money.",
    ],
    screens: <CheckResult />,
  },
];

export default function MobileApp() {
  return (
    <section id="app" className="scroll-mt-20 bg-white py-24">
      <div className="mx-auto max-w-[1680px] px-5 md:px-8 2xl:px-16">
        <div className="mx-auto max-w-[980px] text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-deep">The mobile app</p>
          <h2 className="mt-3 font-grotesk text-[clamp(32px,4.6vw,68px)] font-extrabold leading-[1.05] tracking-[-0.025em]">
            One app. Two people. One <span className="font-accent text-brand-deep">scene that matters.</span>
          </h2>
          <p className="mt-5 text-[18px] leading-relaxed text-ink-muted">
            {demo.student.name} and {demo.guardian.name} use the same app, each with their own screens. Every number on these screens comes from a real run on Monad testnet, recorded below.
          </p>
        </div>

        <div className="mt-20 space-y-24">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 2xl:gap-28 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-ibm-mono text-[14px] font-bold text-brand-deep">{s.n}</span>
                  <span className="h-px w-10 bg-brand" />
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-[12px] font-bold text-brand-ink">
                    {s.who}
                  </span>
                </div>
                <h3 className="mt-4 font-grotesk text-[clamp(26px,3.2vw,36px)] font-bold leading-tight tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-4 text-[17px] leading-relaxed text-ink-muted 2xl:text-[20px]">{s.body}</p>
                <ul className="mt-6 space-y-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-3 text-[15px] leading-snug 2xl:text-[17px]">
                      <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-ink">
                        ✓
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center rounded-[32px] bg-brand-tint py-12">{s.screens}</div>
            </div>
          ))}
        </div>

        <div className="mt-24 flex flex-col items-center rounded-[32px] bg-ink px-6 py-14 text-center text-white">
          <h3 className="font-grotesk text-[clamp(26px,3.6vw,40px)] font-bold tracking-tight">Try it on <span className="font-accent text-brand">your phone</span></h3>
          <p className="mt-3 max-w-[520px] text-[16px] text-white/70">
            Open the app, create a student account, then send the invite to a second device to play Kavya.
          </p>
          <a
            href={APP_URL}
          {...appLinkProps}
            className="mt-8 inline-flex h-[56px] items-center justify-center rounded-full bg-brand px-10 text-[16px] font-bold text-brand-ink shadow-[0_14px_40px_-10px_rgba(0,255,34,0.9)] transition-colors hover:bg-brand-hover"
          >
            Open the mobile app
          </a>
        </div>
      </div>
    </section>
  );
}
