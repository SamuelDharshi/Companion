import { formatUnits, parseUnits } from "viem";
import { USD_DECIMALS } from "./constants";

/**
 * Money formatting.
 *
 * Rule from the PRD, enforced here so it cannot slip: no crypto words ever reach the
 * screen. There is no "AUSD", no "token", no "wei". Amounts are dollars, and that is all
 * a family ever sees.
 */

/** "$1,240" or "$1,240.50" — trailing cents only when they are not zero. */
export function formatUsd(amount: bigint): string {
  const asNumber = Number(formatUnits(amount, USD_DECIMALS));
  const hasCents = Math.round(asNumber * 100) % 100 !== 0;
  return `$${asNumber.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The same amount named as the token it really is: AUSD, Agora's US-dollar stablecoin, which is what the student's balance
 * holds after Agora Instant Settlement. "150 AUSD", "12.50 AUSD".
 */
export function formatAusd(amount: bigint): string {
  return `${formatUsd(amount).slice(1)} AUSD`;
}

/** Dollars as typed by a person, to the 6-decimal onchain unit. */
export function toUnits(dollars: number | string): bigint {
  return parseUnits(String(dollars), USD_DECIMALS);
}

export function toDollars(amount: bigint): number {
  return Number(formatUnits(amount, USD_DECIMALS));
}

/** "0.8s" / "940ms" — the receipt latency shown next to an arrival. */
export function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** "29:41" — the countdown on the hold screen. */
export function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** "2 minutes ago" — used on network evidence and proof lines. */
export function formatAgo(timestampSeconds: number, nowSeconds = Date.now() / 1000): string {
  const diff = Math.max(0, Math.floor(nowSeconds - timestampSeconds));
  if (diff < 60) return `${diff} second${diff === 1 ? "" : "s"} ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
