"use client";

import dynamic from "next/dynamic";

/** three.js only runs in the browser, so the globe is loaded on the client and never server-rendered. */
const Globe = dynamic(() => import("./Globe"), { ssr: false });

export default function GlobeLazy({ className }: { className?: string }) {
  return <Globe className={className} />;
}
