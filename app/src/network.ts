import { NETWORK_STATS_QUERY, SIGNAL_QUERY, queryIndexer } from "@thunai/shared";
import { api, endpoints } from "@/api/client";

/**
 * Where the public numbers and the network evidence come from.
 *
 * The Envio indexer is read first, because it can answer from event history (scams stopped, the
 * median time to stop one). If it is not configured or not reachable, the relayer answers from the
 * contract directly, which can only say how many families, holds and SOS presses there are. The
 * screen says which source it used, and never fills a number the active source cannot supply.
 */
export type NetworkSource = "indexer" | "relayer";

export type NetworkStatsView = {
  source: NetworkSource;
  families: number;
  holdsOpened: number;
  sosRaised: number;
  // Only the indexer can supply these.
  scamsStopped?: number;
  holdsExpired?: number;
  dollarsProtected?: string;
  dollarsDelivered?: string;
  payoutsViaAgora?: number;
  payoutsFallback?: number;
  checksRequested?: number;
  checksAnswered?: number;
  reportsFiled?: number;
  medianSaveSeconds?: number;
  fastestSaveSeconds?: number;
};

/** An indexer is "configured" only if someone set its address; the localhost default is not a deployment. */
export const indexerConfigured = !endpoints.indexer.includes("localhost");

export async function loadNetworkStats(): Promise<NetworkStatsView> {
  if (indexerConfigured) {
    const result = await queryIndexer<{ NetworkStats: Omit<NetworkStatsView, "source">[] }>(
      endpoints.indexer,
      NETWORK_STATS_QUERY,
    );
    const row = result?.NetworkStats?.[0];
    if (row) return { source: "indexer", ...row };
  }
  const fromContract = await api.stats();
  const n = (v: unknown) => (v === undefined ? undefined : Number(v));
  return {
    source: "relayer",
    families: Number(fromContract.families),
    holdsOpened: Number(fromContract.holdsOpened),
    sosRaised: Number(fromContract.sosRaised),
    // Counted from the contract's own events by the relayer, since the indexer is not connected.
    scamsStopped: n(fromContract.scamsStopped),
    holdsExpired: n(fromContract.holdsExpired),
    dollarsProtected: fromContract.dollarsProtected === undefined ? undefined : String(fromContract.dollarsProtected),
    dollarsDelivered: fromContract.dollarsDelivered === undefined ? undefined : String(fromContract.dollarsDelivered),
    payoutsViaAgora: n(fromContract.payoutsViaAgora),
    payoutsFallback: n(fromContract.payoutsFallback),
    checksRequested: n(fromContract.checksRequested),
    checksAnswered: n(fromContract.checksAnswered),
    reportsFiled: n(fromContract.reportsFiled),
    medianSaveSeconds: n(fromContract.medianSaveSeconds),
    fastestSaveSeconds: n(fromContract.fastestSaveSeconds),
  };
}

/**
 * "N verified families reported this payee." From the indexer when it has it, otherwise the
 * contract's own counter (which the relayer already put on the hold). Either way the number is the
 * contract's, because the indexer copies it rather than counting.
 */
export async function loadEvidence(
  handleHash: string,
  fallback: { count: number; lastAt: number },
): Promise<{ count: number; lastAt: number; source: NetworkSource }> {
  if (indexerConfigured) {
    const result = await queryIndexer<{ Signal: { reports: number; lastAt: string }[] }>(
      endpoints.indexer,
      SIGNAL_QUERY,
      { handleHash },
    );
    const signal = result?.Signal?.[0];
    if (signal) return { count: signal.reports, lastAt: Number(signal.lastAt), source: "indexer" };
  }
  return { ...fallback, source: "relayer" };
}
