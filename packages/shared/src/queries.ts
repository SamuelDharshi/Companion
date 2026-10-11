/**
 * GraphQL the app sends to the Envio indexer.
 *
 * Kept here rather than in the app so the queries and the indexer schema can be reviewed
 * side by side, and so the agent can read the same data without duplicating strings.
 *
 * Note what is read from the indexer and what is not: the feed, the network evidence and
 * the traction counters come from here, but the hold decision itself is always read from
 * the contract. An indexer lag must never be able to show a family a stale "safe".
 */

/** The student's home screen and the guardian's feed. */
export const FAMILY_FEED_QUERY = /* GraphQL */ `
  query FamilyFeed($familyId: String!) {
    Family(where: { id: { _eq: $familyId } }) {
      id
      student
      guardian
      balance
      homeBalance
      weeklyAmount
      perWithdrawalCap
      cadence
      nextRunAt
      frozen
      totalReceived
      totalHeld
      scamsStopped
      payouts(order_by: { timestamp: desc }, limit: 20) {
        id
        amountIn
        amountOut
        viaAgora
        timestamp
        txHash
      }
      holds(order_by: { openedAt: desc }, limit: 20) {
        id
        to
        amount
        reason
        reasonName
        scriptId
        status
        openedAt
        releaseAt
        resolvedAt
        secondsToResolve
        stoppedByGuardian
        txHash
      }
      withdrawals(order_by: { timestamp: desc }, limit: 20) {
        id
        to
        amount
        timestamp
        txHash
      }
      checks(order_by: { requestedAt: desc }, limit: 5) {
        id
        nonce
        requestedAt
        provedAt
        latencySeconds
        answered
      }
    }
  }
`;

/** Any hold still open for a family: what the guardian must decide on right now. */
export const OPEN_HOLDS_QUERY = /* GraphQL */ `
  query OpenHolds($familyId: String!) {
    Hold(
      where: { family_id: { _eq: $familyId }, status: { _eq: "OPEN" } }
      order_by: { openedAt: desc }
    ) {
      id
      to
      amount
      reason
      reasonName
      scriptId
      openedAt
      releaseAt
      txHash
    }
  }
`;

/**
 * The evidence line on a hold card: "1 verified family reported this number, 2 min ago".
 * `reports` comes from the contract's own counter, so it cannot be inflated here.
 */
export const SIGNAL_QUERY = /* GraphQL */ `
  query Signal($handleHash: String!) {
    Signal(where: { id: { _eq: $handleHash } }) {
      id
      reports
      lastAt
      scriptId
      firstReportedAt
      rebuttals
    }
  }
`;

/** The public "families protected" counter, and the traction numbers for the write-up. */
export const NETWORK_STATS_QUERY = /* GraphQL */ `
  query NetworkStats {
    NetworkStats(where: { id: { _eq: "global" } }) {
      families
      holdsOpened
      scamsStopped
      holdsExpired
      dollarsProtected
      dollarsDelivered
      payoutsViaAgora
      payoutsFallback
      checksRequested
      checksAnswered
      reportsFiled
      sosRaised
      medianSaveSeconds
      fastestSaveSeconds
      updatedAt
    }
  }
`;

/** A single hold, for the deep link a push notification opens. */
export const HOLD_QUERY = /* GraphQL */ `
  query Hold($holdId: String!) {
    Hold(where: { id: { _eq: $holdId } }) {
      id
      family_id
      to
      amount
      reason
      reasonName
      scriptId
      status
      openedAt
      releaseAt
      resolvedAt
      secondsToResolve
      stoppedByGuardian
      txHash
    }
  }
`;

/** Minimal GraphQL client. Returns undefined rather than throwing: the feed is a nicety. */
export async function queryIndexer<T>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> = {},
  timeoutMs = 6000,
): Promise<T | undefined> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { data?: T; errors?: unknown[] };
    if (body.errors?.length) return undefined;
    return body.data;
  } catch {
    // The contract is the source of truth for every decision; this is only the feed.
    return undefined;
  }
}
