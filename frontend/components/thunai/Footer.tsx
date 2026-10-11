import { APP_URL, appLinkProps } from "@/lib/app";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white py-12">
      <div className="mx-auto flex max-w-[1680px] flex-col items-start justify-between gap-6 px-5 md:flex-row md:items-center md:px-8 2xl:px-16">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-auto" />
          <span className="font-grotesk text-[18px] font-extrabold">Companion</span>
          <span className="text-[14px] text-ink-faint">· family is your second key</span>
        </div>
        <div className="flex items-center gap-6 text-[14px] text-ink-muted">
          <a href="#app" className="hover:text-brand-deep">
            How the app works
          </a>
          <a href="#faq" className="hover:text-brand-deep">
            FAQ
          </a>
          <a href={APP_URL}
          {...appLinkProps} className="font-bold text-brand-deep hover:underline">
            Open the app →
          </a>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-[1680px] px-5 text-[12px] text-ink-faint md:px-8 2xl:px-16">
        Built for Monad Metropolis on Monad testnet. Testnet funds are labelled stand-ins and have no real value.
      </p>
    </footer>
  );
}
