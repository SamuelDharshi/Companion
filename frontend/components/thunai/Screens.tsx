import Phone, { FamilyLine, GreenButton } from "./Phone";
import { demo, nextAllowance, scriptName, seconds, secondsBetween, steps, usd, HOLD_TIMEOUT_MINUTES } from "@/lib/demo";

/*
 * The screens people actually use, mirroring the real app. Every figure, name and sentence
 * comes from the recorded Monad testnet run in `lib/demo.ts`, not from this file.
 */

const student = demo.student.name;
const guardian = demo.guardian.name;
const initials = [student[0], guardian[0]] as const;

export function StudentHome() {
  return (
    <Phone label="Student home screen">
      <FamilyLine left={initials[0]} right={initials[1]} />
      <p className="mt-4 text-[11px] font-semibold tracking-wide text-ink-faint">YOUR BALANCE</p>
      <p className="font-grotesk text-[38px] font-bold leading-none tracking-tight">{demo.final.balanceLabel}</p>
      <div className="mt-3 rounded-2xl bg-brand-tint p-3">
        <p className="text-[11px] font-semibold uppercase text-brand-deep">Next allowance</p>
        <p className="text-[13px] font-bold">
          {usd(demo.final.weeklyAmount)} from {guardian}
        </p>
        <p className="text-[11px] text-ink-muted">{nextAllowance}</p>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-2xl border border-line p-3">
        <div>
          <p className="text-[13px] font-bold">Rent · {usd(steps.rent?.amount ?? 0)}</p>
          <p className="text-[11px] text-ink-muted">
            Paid in {seconds(steps.rent?.latencyMs)}. {guardian} approved it.
          </p>
        </div>
        <span className="rounded-full bg-brand-soft px-2 py-[2px] text-[10px] font-bold text-brand-ink">AUTO</span>
      </div>
      <div className="mt-2 rounded-2xl border border-line p-3">
        <p className="text-[11px] font-semibold text-ink-faint">RECENT</p>
        <p className="mt-1 flex justify-between text-[12px]">
          <span>Allowance from {guardian}</span>
          <b className="text-brand-deep">+{usd(steps.allowance?.amount ?? 0)}</b>
        </p>
        <p className="mt-1 flex justify-between text-[12px]">
          <span>From home, settled</span>
          <b className="text-brand-deep">+{usd(steps.settled?.amount ?? 0)}</b>
        </p>
        <p className="mt-1 flex justify-between text-[12px]">
          <span>Rent</span>
          <b>−{usd(steps.rent?.amount ?? 0)}</b>
        </p>
      </div>
      <div className="mt-auto flex gap-2">
        <div className="flex-1 rounded-xl bg-brand py-[11px] text-center text-[13px] font-bold text-brand-ink">
          Send money
        </div>
        <div className="flex-1 rounded-xl border border-line py-[11px] text-center text-[13px] font-bold">Details</div>
      </div>
    </Phone>
  );
}

export function SendMoney() {
  return (
    <Phone label="Send money screen">
      <p className="font-grotesk text-[20px] font-bold">Send money</p>
      <p className="mt-3 text-[11px] font-semibold text-ink-faint">TO</p>
      <div className="rounded-xl border border-line px-3 py-[10px] text-[13px]">
        New person <span className="text-ink-faint">· not on the schedule</span>
      </div>
      <p className="mt-3 text-[11px] font-semibold text-ink-faint">AMOUNT</p>
      <p className="font-grotesk text-[34px] font-bold leading-none">{demo.hold.amountLabel}</p>
      <p className="mt-3 text-[11px] font-semibold text-ink-faint">
        WHAT&apos;S THIS FOR? <span className="text-brand-deep">(REQUIRED)</span>
      </p>
      <div className="rounded-xl border border-line px-3 py-[10px] text-[13px] capitalize">{demo.hold.memo}</div>
      <div className="mt-3 rounded-2xl bg-held-soft p-3 text-[12px] text-held-ink">
        Payments to new people are held for a moment so family can look first.
      </div>
      <div className="mt-auto">
        <GreenButton>Send {demo.hold.amountLabel}</GreenButton>
      </div>
    </Phone>
  );
}

export function HeldForSafety() {
  return (
    <Phone label="Safety hold screen">
      <FamilyLine left={initials[0]} right={initials[1]} />
      <div className="mt-4 rounded-2xl bg-held-soft p-4">
        <p className="text-[11px] font-bold tracking-wide text-held-ink">⏳ HELD FOR SAFETY</p>
        <p className="font-grotesk text-[34px] font-bold leading-tight text-ink">{demo.hold.amountLabel}</p>
        <p className="text-[12px] text-held-ink">
          to a new person · held in {seconds(steps.held?.latencyMs)}. We&apos;ve asked {guardian}.
        </p>
      </div>
      <div className="mt-2 rounded-2xl border border-line p-3">
        <p className="text-[11px] font-semibold text-ink-faint">THIS LOOKS LIKE</p>
        <p className="text-[13px] font-bold">the {scriptName}</p>
        {demo.brief?.explanation ? (
          <p className="mt-1 text-[10.5px] leading-snug text-ink-muted">{demo.brief.explanation}</p>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-brand-tint p-3">
        <span className="text-[12px] font-semibold">Waiting for {guardian}</span>
        <span className="font-ibm-mono text-[11px] font-bold text-brand-deep">{HOLD_TIMEOUT_MINUTES} min limit</span>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-ink-muted">
        If nobody answers in {HOLD_TIMEOUT_MINUTES} minutes, the money goes back to you. Never to them.
      </p>
    </Phone>
  );
}

export function GuardianAlert() {
  return (
    <Phone label="Parent alert screen">
      <FamilyLine left={initials[0]} right={initials[1]} />
      <p className="mt-4 font-grotesk text-[20px] font-bold leading-tight">
        {demo.brief?.alertTitle ?? `${student} needs you`}
      </p>
      {demo.brief?.alertBody ? (
        <div className="mt-3 rounded-2xl bg-held-soft p-3 text-[11.5px] leading-snug text-held-ink">
          {demo.brief.alertBody}
        </div>
      ) : null}
      <div className="mt-auto space-y-2">
        <GreenButton>Stop it</GreenButton>
        <div className="rounded-xl border border-line py-[11px] text-center text-[13px] font-bold">Allow</div>
        <p className="text-center text-[11px] text-ink-muted">Not sure? Stop it. {student} gets the money back.</p>
      </div>
    </Phone>
  );
}

export function StoppedResult() {
  const held = secondsBetween(steps.held, steps.stopped);
  return (
    <Phone label="Payment stopped">
      <FamilyLine left={initials[0]} right={initials[1]} />
      <div className="mt-4 rounded-2xl bg-brand-soft p-4">
        <p className="text-[11px] font-bold tracking-wide text-brand-deep">✓ STOPPED BY {guardian.toUpperCase()}</p>
        <p className="font-grotesk text-[34px] font-bold leading-tight">{demo.hold.amountLabel}</p>
        <p className="text-[12px] text-brand-ink">is back with {student}. The new person received nothing.</p>
      </div>
      <div className="mt-2 rounded-2xl border border-line p-3 text-[12px]">
        <p className="flex justify-between">
          <span className="text-ink-muted">Balance while held</span>
          <b>{steps.stopped?.balanceWhileHeld}</b>
        </p>
        <p className="mt-1 flex justify-between">
          <span className="text-ink-muted">Balance after</span>
          <b className="text-brand-deep">{steps.stopped?.balanceAfter}</b>
        </p>
        {held !== undefined ? (
          <p className="mt-1 flex justify-between">
            <span className="text-ink-muted">Held for</span>
            <b>{held}s</b>
          </p>
        ) : null}
        <p className="mt-1 flex justify-between">
          <span className="text-ink-muted">Stop confirmed in</span>
          <b>{seconds(steps.stopped?.latencyMs)}</b>
        </p>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-ink-muted">
        Signed with {guardian}&apos;s passkey and checked inside the contract.
      </p>
    </Phone>
  );
}

export function CheckResult() {
  return (
    <Phone label="Check on the student result">
      <FamilyLine left={initials[0]} right={initials[1]} />
      <div className="mt-4 rounded-2xl bg-brand-soft p-4">
        <p className="text-[11px] font-bold tracking-wide text-brand-deep">
          ✓ SIGNED ON {student.toUpperCase()}&apos;S PHONE
        </p>
        <p className="font-grotesk text-[26px] font-bold leading-tight">Verified in {seconds(steps.checked?.latencyMs)}</p>
        <p className="text-[12px] text-brand-ink">His passkey answered. This is really his phone, in his hand.</p>
      </div>
      <div className="mt-2 rounded-2xl border border-line p-3 text-[12px] leading-snug text-ink-muted">
        <b className="text-ink">This does not prove he is safe.</b> Call him on video too.
      </div>
      <div className="mt-auto space-y-2">
        <div className="rounded-xl bg-brand py-[11px] text-center text-[13px] font-bold text-brand-ink">
          Check on {student}
        </div>
        <div className="rounded-xl border border-line py-[11px] text-center text-[13px] font-bold">Send money now</div>
      </div>
    </Phone>
  );
}

export function AcceptInvite() {
  return (
    <Phone label="Parent accepts invitation">
      <div className="mt-6 flex justify-center">
        <FamilyLine left={initials[0]} right={initials[1]} />
      </div>
      <p className="mt-6 text-center font-grotesk text-[22px] font-bold leading-tight">
        {student} wants you as his Companion
      </p>
      <p className="mt-2 text-center text-[12px] text-ink-muted">
        You approve anything unusual. You never have to set anything up.
      </p>
      <div className="mt-4 rounded-xl border border-line px-3 py-[10px] text-[13px] text-ink-faint">Your name</div>
      <div className="mt-auto space-y-2">
        <GreenButton>Accept with Face ID</GreenButton>
        <p className="text-center text-[11px] text-ink-muted">No password. No recovery phrase.</p>
      </div>
    </Phone>
  );
}
