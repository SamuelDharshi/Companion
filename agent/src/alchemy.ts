import { createHmac, timingSafeEqual } from "node:crypto";
import { toEventSelector } from "viem";

/**
 * Alchemy webhook support: a second, chain-driven way to learn that something needs the parent.
 *
 * Our relayer tells the agent the instant it opens a hold. That path is fast, but it depends on our own relayer. An
 * Alchemy webhook watches Monad testnet itself and calls us when the vault emits `HoldOpened` or `SOSRaised`, so a parent is
 * still paged if the relayer's call to the agent never arrived, or if the vault was called some other way.
 *
 * The handler dedupes against the relayer path, so a parent is never paged twice for one event.
 */

/** keccak256 of the event signatures in ThunaiVault. These are what the webhook filters on. */
export const HOLD_OPENED_TOPIC = toEventSelector("HoldOpened(uint256,uint256,address,uint128,uint8,uint64,bytes32)");
export const SOS_RAISED_TOPIC = toEventSelector("SOSRaised(uint256,uint8,uint64)");

/**
 * Alchemy signs the exact request body with HMAC-SHA256 using the webhook's signing key and sends the hex digest in
 * `x-alchemy-signature`. Compared in constant time.
 */
export function signatureMatches(rawBody: string, header: unknown, signingKey: string | undefined): boolean {
  if (!signingKey || typeof header !== "string") return false;
  const expected = createHmac("sha256", signingKey).update(rawBody, "utf8").digest("hex");
  const given = header.trim().toLowerCase().replace(/^0x/, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type WebhookLog = { topics: string[]; data?: string; txHash?: string; logIndex?: number };

/**
 * Finds every log in a webhook body. A custom (GraphQL) webhook nests logs under `event.data.block.logs`, and other
 * webhook types nest them differently, so this walks the whole payload and accepts any object with a `topics` array rather
 * than depend on one exact shape.
 */
export function extractLogs(payload: unknown): WebhookLog[] {
  const found: WebhookLog[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.topics) && obj.topics.every((t) => typeof t === "string") && obj.topics.length > 0) {
      const tx = obj.transaction as { hash?: unknown } | undefined;
      found.push({
        topics: (obj.topics as string[]).map((t) => t.toLowerCase()),
        data: typeof obj.data === "string" ? obj.data : undefined,
        txHash: typeof tx?.hash === "string" ? tx.hash : typeof obj.transactionHash === "string" ? obj.transactionHash : undefined,
        logIndex: typeof obj.logIndex === "number" ? obj.logIndex : undefined,
      });
      return;
    }
    for (const value of Object.values(obj)) walk(value, depth + 1);
  };
  walk(payload, 0);
  return found;
}

/** An indexed uint256 topic as a decimal string. */
export function topicToId(topic: string | undefined): string | undefined {
  if (!topic || !/^0x[0-9a-f]{1,64}$/i.test(topic)) return undefined;
  return BigInt(topic).toString();
}
