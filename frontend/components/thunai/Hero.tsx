import { APP_URL, appLinkProps } from "@/lib/app";
import { HeldForSafety, StudentHome } from "./Screens";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-tint to-white">
      <div className="mx-auto grid max-w-[1680px] items-center gap-12 px-5 pb-20 pt-[120px] 2xl:pb-28 md:px-8 2xl:px-16 lg:grid-cols-[1fr_1fr] 2xl:gap-20 lg:pt-[140px]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-brand shadow-[0_0_10px_2px_rgba(0,255,34,0.8)]" />
            Mobile app · real transactions on Monad testnet
          </span>
          <h1 className="mt-6 font-grotesk text-[clamp(40px,6.4vw,104px)] font-extrabold leading-[1] tracking-[-0.03em]">
            Money from home,
            <br />
            with <span className="rounded-2xl bg-brand px-4 pb-1 font-accent text-brand-ink">family</span> watching.
          </h1>
          <p className="mt-6 max-w-[620px] text-[18px] 2xl:text-[21px] leading-relaxed text-ink-muted">
            Companion moves a student&apos;s allowance across borders in about a second. When something looks
            wrong, it pauses the money and tells their parent before anything leaves.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href={APP_URL}
          {...appLinkProps}
              className="inline-flex h-[56px] items-center justify-center rounded-full bg-brand px-8 text-[16px] font-bold text-brand-ink shadow-[0_14px_30px_-10px_rgba(0,255,34,0.9)] transition-colors hover:bg-brand-hover"
            >
              Open the mobile app
            </a>
            <a
              href="#app"
              className="inline-flex h-[56px] items-center justify-center rounded-full border border-line px-8 text-[16px] font-bold transition-colors hover:border-brand-deep hover:text-brand-deep"
            >
              See how it works
            </a>
          </div>
          <p className="mt-5 text-[13px] text-ink-faint">
            No password. No recovery phrase. One Face ID. Opens in your phone&apos;s browser, and you can add it
            to your home screen.
          </p>
        </div>

        {/* A gentle 3D lean on the two phones; it straightens when hovered. */}
        <div className="relative flex justify-center gap-5 [perspective:1600px] lg:justify-end">
          <div className="hidden translate-y-10 transition-transform duration-500 [transform:rotateY(14deg)_rotateX(4deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)] sm:block">
            <StudentHome />
          </div>
          <div className="transition-transform duration-500 [transform:rotateY(-10deg)_rotateX(4deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)]">
            <HeldForSafety />
          </div>
        </div>
      </div>
    </section>
  );
}
