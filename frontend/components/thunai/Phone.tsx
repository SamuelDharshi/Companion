import type { ReactNode } from "react";

/** A phone frame. The screen is real markup, not an image, so it stays sharp and editable. */
export default function Phone({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <figure className={`mx-auto w-[272px] shrink-0 xl:[zoom:1.12] 2xl:[zoom:1.3] ${className}`} aria-label={label}>
      <div className="relative rounded-[44px] border-[10px] border-ink bg-ink shadow-[0_30px_60px_-20px_rgba(0,122,30,0.35)]">
        <div className="absolute left-1/2 top-[7px] z-10 h-[18px] w-[84px] -translate-x-1/2 rounded-full bg-ink" />
        <div className="relative h-[540px] overflow-hidden rounded-[34px] bg-white">
          <div className="flex h-full flex-col px-4 pb-4 pt-9">{children}</div>
        </div>
      </div>
    </figure>
  );
}

/** The thin line that joins the student and the parent. Green means a passkey acted. */
export function FamilyLine({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-center">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4f8f4] text-[11px] font-bold text-ink-muted">
        {left}
      </span>
      <span className="h-[2px] w-9 bg-brand" />
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">
        {right}
      </span>
    </div>
  );
}

export function GreenButton({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-brand py-[11px] text-center text-[13px] font-bold text-brand-ink shadow-[0_6px_18px_-6px_rgba(0,255,34,0.7)]">
      {children}
    </div>
  );
}
