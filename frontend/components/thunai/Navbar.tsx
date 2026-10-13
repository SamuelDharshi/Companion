import { APP_URL, appLinkProps } from "@/lib/app";

const links = [
  { label: "How the app works", href: "/#app" },
  { label: "Safeguards", href: "/#safeguards" },
  { label: "FAQ", href: "/#faq" },
];

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-[64px] max-w-[1680px] items-center justify-between px-5 md:px-8 2xl:px-16">
        <a href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-auto" />
          <span className="font-grotesk text-[20px] font-extrabold tracking-tight">Companion</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] font-medium text-ink-muted transition-colors hover:text-brand-deep"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href={APP_URL}
          {...appLinkProps}
          className="rounded-full bg-brand px-5 py-2.5 text-[14px] font-bold text-brand-ink shadow-[0_8px_20px_-8px_rgba(0,255,34,0.9)] transition-colors hover:bg-brand-hover"
        >
          Open the app
        </a>
      </div>
    </header>
  );
}
