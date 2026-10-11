import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Config, type FamilyState, type HoldBrief, type HoldState } from "@/api/client";

/**
 * Data hooks.
 *
 * Everything that decides anything is read from the contract through the relayer, not
 * from the indexer. A stale "all good" is the one failure this product cannot have, so
 * the indexer is used for history and counters only.
 *
 * Polling, rather than sockets, on purpose: it is two fewer moving parts during a live
 * demo on hotel wifi, and at 2.5s the guardian's screen updates faster than she can read
 * the alert she was just paged with.
 */

const POLL_MS = 2500;

export function useAsync<T>(
  load: () => Promise<T>,
  deps: unknown[],
  options: { pollMs?: number; enabled?: boolean } = {},
): {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  refresh: () => void;
} {
  const { pollMs, enabled = true } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  // Avoids a setState after unmount, which React logs loudly during a demo.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const run = async () => {
      try {
        const result = await load();
        if (cancelled || !alive.current) return;
        setData(result);
        setError(undefined);
      } catch (cause) {
        if (cancelled || !alive.current) return;
        setError((cause as Error).message);
      } finally {
        if (!cancelled && alive.current) setLoading(false);
      }
    };

    void run();
    if (!pollMs) return () => {
      cancelled = true;
    };

    const timer = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled, pollMs]);

  return { data, error, loading, refresh };
}

/** Chain ids and addresses, and whether Agora is really enabled. Fetched once. */
export function useConfig() {
  return useAsync<Config>(() => api.config(), []);
}

/** The family, polled. This drives both home screens. */
export function useFamily(familyId: string | undefined) {
  return useAsync<FamilyState>(
    () => api.family(familyId!),
    [familyId],
    { pollMs: POLL_MS, enabled: Boolean(familyId) },
  );
}

export function useHold(holdId: string | undefined) {
  return useAsync<HoldState>(
    () => api.hold(holdId!),
    [holdId],
    { pollMs: POLL_MS, enabled: Boolean(holdId) },
  );
}

/**
 * The agent's briefing for a hold: the scam label and the explanation.
 *
 * Allowed to be missing. The hold screen renders fully without it, because the hold is
 * already open and already safe whether or not the classifier ever answers.
 */
export function useHoldBrief(holdId: string | undefined) {
  return useAsync<HoldBrief | undefined>(
    async () => {
      try {
        return await api.brief(holdId!);
      } catch {
        return undefined;
      }
    },
    [holdId],
    { pollMs: 3000, enabled: Boolean(holdId) },
  );
}

/** Polls an invite until the guardian accepts, then stops. */
export function useInvite(code: string | undefined, until: boolean) {
  return useAsync(
    () => api.invite(code!),
    [code],
    { pollMs: until ? 2000 : undefined, enabled: Boolean(code) },
  );
}

/** A countdown that ticks every second, for the hold timer. */
export function useCountdown(releaseAt: number | undefined): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!releaseAt) return;
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, [releaseAt]);
  return releaseAt ? Math.max(0, releaseAt - now) : 0;
}
