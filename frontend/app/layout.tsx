import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Serif, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/** Headings: a heavy, characterful grotesque. */
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

/** Body: a friendly, slightly geometric sans. */
const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Accent: an elegant italic serif for the one word in a heading that carries the meaning. */
const accent = Instrument_Serif({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Companion — Money from home, with family watching",
  description:
    "A family money agent for Indian parents with a child studying abroad. The allowance arrives in about a second, and anything unusual pauses until family says yes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${display.variable} ${body.variable} ${accent.variable} ${ibmPlexMono.variable} h-full bg-white text-ink overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
