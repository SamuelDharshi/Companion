import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * The last confirmation time this phone actually measured.
 *
 * Every money action returns how long the relayer waited for the transaction's receipt. The home
 * screens show that number next to a bank transfer, so the comparison is always a real measurement
 * and never a figure typed into the app. Nothing is shown until there is one.
 */
export type Measured = { ms: number; what: string; at: number };

const KEY = "thunai.latency.v1";
let last: Measured | undefined;
const listeners = new Set<(m: Measured | undefined) => void>();

const LABELS: Record<string, string> = {
  "/withdraw": "your last payment",
  "/partner/deposit": "your last deposit",
  "/hold/resolve": "the last decision",
  "/check/prove": "the last check",
  "/freeze": "the last pause",
};

/** Called by the API client for any response that reports a latency. */
export function recordLatency(path: string, ms: number) {
  const what = LABELS[path.split("?")[0] ?? ""];
  if (!what || !Number.isFinite(ms) || ms <= 0) return;
  last = { ms, what, at: Date.now() };
  listeners.forEach((fn) => fn(last));
  AsyncStorage.setItem(KEY, JSON.stringify(last)).catch(() => undefined);
}

export function useLastLatency(): Measured | undefined {
  const [value, setValue] = useState<Measured | undefined>(last);
  useEffect(() => {
    let alive = true;
    listeners.add(setValue);
    // Pick up a number measured in an earlier session, if there is one.
    if (!last) {
      AsyncStorage.getItem(KEY)
        .then((raw) => {
          if (raw && alive && !last) {
            last = JSON.parse(raw) as Measured;
            setValue(last);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
