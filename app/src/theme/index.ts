import { Platform } from "react-native";

/**
 * The Companion visual system, built from Monad's brand kit into something warm enough for
 * a parent's phone.
 *
 * The one rule that carries meaning rather than taste: `trust` (green) appears
 * ONLY where a passkey acts. An approval, the Companion seal, a "Signed by" line. Nothing
 * decorative is ever purple, so purple on screen always means a real family member
 * authorised something. Breaking that rule would quietly destroy the only visual signal
 * the product has.
 */
export const colors = {
  /** White, with a barely-there green tint for grouped areas. */
  bg: "#FFFFFF",
  bgTint: "#F2FFF4",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F8F4",

  ink: "#0B1A0F",
  inkMuted: "#4B5A4F",
  inkFaint: "#7E8C82",
  hairline: "#E3EAE3",

  /**
   * Green, from the "Green Screen" palette (#00ff00 .. #00ff44). Guardian and passkey
   * moments only. Fills carry it; text on a fill is `onTrust`.
   *
   * Neon green on white is about 1.4:1, which is unreadable as text, so green that has
   * to be READ on a white page is `trustText`, a deeper green made for that job.
   */
  trust: "#00FF22",
  trustPressed: "#00FF11",
  trustSoft: "#DCFFE2",
  trustInk: "#04440F",
  trustText: "#007A1E",
  onTrust: "#04210A",

  /** Money arrived. Another shade from the same palette. */
  arrived: "#00FF44",
  arrivedInk: "#04440F",
  arrivedSoft: "#E3FFE8",

  /** Held for safety. Never alarm red: the money is safe, not lost. */
  held: "#FFAE45",
  heldInk: "#6B3E00",
  heldSoft: "#FFF1DE",

  /** Confirmed scam. Soft pink, deliberately not red. */
  scam: "#FF8EE4",
  scamInk: "#6B0053",
  scamSoft: "#FFE9F8",

  white: "#FFFFFF",
} as const;

export const darkColors = {
  ...colors,
  bg: "#0E091C",
  bgTint: "#160F2C",
  surface: "#1B1333",
  surfaceMuted: "#241a42",
  ink: "#F6F4FF",
  inkMuted: "#B5AECC",
  inkFaint: "#857E9C",
  hairline: "#2E2450",
} as const;

/**
 * Type.
 *
 * Britti Sans is Monad's display face and is not licensed for us, so headings use Bricolage
 * Grotesque on web and the platform geometric sans elsewhere, which is the documented fallback rather than a
 * substitution we invented. a mono face is
 * used only for proof details, where character alignment is the point.
 */
export const fonts = {
  // On web these are real Google Fonts, loaded in app/+html.tsx. On a native build they fall
  // back to the platform fonts until the font files are bundled.
  display: Platform.select({
    ios: "SF Pro Rounded",
    android: "sans-serif-medium",
    default: "'Bricolage Grotesque', system-ui, -apple-system, Segoe UI, sans-serif",
  }) as string,
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "'Plus Jakarta Sans', system-ui, -apple-system, Segoe UI, sans-serif",
  }) as string,
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "'Roboto Mono', ui-monospace, SFMono-Regular, monospace",
  }) as string,
};

export const type = {
  /** A balance, or an amount on a hold card. The largest thing on any screen. */
  amount: { fontFamily: fonts.display, fontSize: 44, fontWeight: "700" as const, letterSpacing: -1 },
  amountSmall: { fontFamily: fonts.display, fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.display, fontSize: 19, fontWeight: "600" as const },
  body: { fontFamily: fonts.body, fontSize: 16, fontWeight: "400" as const, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.body, fontSize: 16, fontWeight: "600" as const, lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  label: { fontFamily: fonts.body, fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.2 },
  /** Receipt numbers, latency, block height. */
  proof: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "400" as const },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** 20px cards, per the PRD. Pills are fully round. */
export const radius = {
  sm: 10,
  md: 14,
  card: 20,
  pill: 999,
} as const;

export const shadow = {
  card: Platform.select({
    web: { boxShadow: "0 1px 2px rgba(14,9,28,0.04), 0 8px 24px rgba(14,9,28,0.06)" } as object,
    default: {
      shadowColor: "#0E091C",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  }),
  /** Used only on guardian actions, so the purple lifts off the page. */
  trust: Platform.select({
    web: { boxShadow: "0 2px 8px rgba(0,255,34,0.30), 0 12px 28px rgba(0,255,34,0.20)" } as object,
    default: {
      shadowColor: "#00FF22",
      shadowOpacity: 0.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  }),
};

/** The phone the PRD designs for. Wider screens centre this column. */
export const LAYOUT = {
  maxWidth: 420,
  gutter: 20,
} as const;

/** Hold reason to the colour and copy a family should see. */
export function reasonTone(reason: number) {
  switch (reason) {
    case 4: // NETWORK_FLAG
      return { bg: colors.scamSoft, fg: colors.scamInk, accent: colors.scam };
    case 6: // FROZEN
      return { bg: colors.trustSoft, fg: colors.trustInk, accent: colors.trust };
    default:
      return { bg: colors.heldSoft, fg: colors.heldInk, accent: colors.held };
  }
}
