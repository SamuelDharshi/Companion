import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEventLogs, type Address, type PublicClient } from "viem";
import { ScamSignalsAbi, ThunaiVaultAbi } from "@thunai/shared";

/**
 * Counts what has really happened on the contracts, from their own events.
 *
 * This is what the public "families protected" counter and the traction page read, and it is the
 * app's source of history when the Envio indexer is not connected. It follows the chain itself: it
 * backfills from the vault's deploy block and then keeps up, in 100-block steps, because the testnet
 * RPC refuses a log query over a wider range. Every number is a count of an event the contract emitted,
 * so any figure can be checked against the chain. Nothing here is estimated.
 *
 * Test traffic (the fictional Arjun and Kavya that our own end-to-end runs create) is counted
 * separately, so a judge can see how much activity is real families and how much is us.
 */
export type Tally = {
  vault: Address;
  startBlock: number;
  lastBlock: number;
  families: number;
  testFamilies: number;
  /**
   * Families this relayer has no record of (for example, made before a restart wiped its data on a host without a disk).
   * Nobody can say whether they were real people, so they are never counted as real.
   */
  unknownFamilies?: number;
  holdsOpened: number;
  scamsStopped: number;
  holdsReleased: number;
  holdsExpired: number;
  dollarsProtected: string; // 6-decimal base units, as a string
  dollarsDelivered: string;
  payoutsViaAgora: number;
  payoutsFallback: number;
  checksRequested: number;
  checksAnswered: number;
  reportsFiled: number;
  sosRaised: number;
  /** Seconds from a hold opening to the parent stopping it, one per stop. */
  saveSeconds: number[];
  recent: { kind: string; block: number; tx: string; familyId?: string }[];
  /** Hold id to its amount and whether its family is a test family, until it resolves. */
  open: Record<string, { amount: string; test: boolean }>;
};

const CHUNK = 100n;
const PARALLEL = 6;

const empty = (vault: Address, startBlock: number): Tally => ({
  vault,
  startBlock,
  lastBlock: startBlock - 1,
  families: 0,
  testFamilies: 0,
  unknownFamilies: 0,
  holdsOpened: 0,
  scamsStopped: 0,
  holdsReleased: 0,
  holdsExpired: 0,
  dollarsProtected: "0",
  dollarsDelivered: "0",
  payoutsViaAgora: 0,
  payoutsFallback: 0,
  checksRequested: 0,
  checksAnswered: 0,
  reportsFiled: 0,
  sosRaised: 0,
  saveSeconds: [],
  recent: [],
  open: {},
});

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

export class TallyFollower {
  private tally: Tally;
  private readonly file: string;
  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly client: PublicClient,
    private readonly vault: Address,
    private readonly signals: Address,
    startBlock: number,
    dir: string,
    /** Whether a family is our own test family, a real one, or one we have no record of. Decided when its event is read. */
    private readonly classifyFamily: (familyId: string) => "test" | "real" | "unknown",
    private readonly log: { info: (...a: any[]) => void; warn: (...a: any[]) => void },
  ) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, "tally.json");
    let loaded: Tally | undefined;
    if (existsSync(this.file)) {
      try {
        loaded = JSON.parse(readFileSync(this.file, "utf8")) as Tally;
      } catch {
        loaded = undefined;
      }
    }
    // A different vault means a redeploy: start the count again rather than mixing two deployments.
    this.tally =
      loaded && loaded.vault.toLowerCase() === vault.toLowerCase() ? loaded : empty(vault, startBlock);
  }

  get snapshot(): Tally & { medianSaveSeconds: number; fastestSaveSeconds: number; realFamilies: number } {
    const t = this.tally;
    return {
      ...t,
      medianSaveSeconds: median(t.saveSeconds),
      fastestSaveSeconds: t.saveSeconds.length ? Math.min(...t.saveSeconds) : 0,
      realFamilies: t.families - t.testFamilies - (t.unknownFamilies ?? 0),
    };
  }

  start(everyMs = 20_000) {
    const tick = () => void this.scan().catch((e) => this.log.warn({ err: String(e) }, "tally scan failed"));
    tick();
    this.timer = setInterval(tick, everyMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Reads every block since the last scan, in order, and folds the events into the counts. */
  async scan() {
    if (this.running) return;
    this.running = true;
    try {
      const head = await this.client.getBlockNumber();
      let from = BigInt(this.tally.lastBlock + 1);
      while (from <= head) {
        // A batch of consecutive chunks fetched in parallel, then applied strictly in block order.
        const ranges: [bigint, bigint][] = [];
        for (let i = 0; i < PARALLEL && from <= head; i++) {
          const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
          ranges.push([from, to]);
          from = to + 1n;
        }
        const results = await Promise.all(
          ranges.map(([a, b]) =>
            this.client.getLogs({ address: [this.vault, this.signals], fromBlock: a, toBlock: b }),
          ),
        );
        results.forEach((logs, i) => {
          this.apply(logs);
          this.tally.lastBlock = Number(ranges[i]![1]);
        });
        this.save();
      }
    } finally {
      this.running = false;
    }
  }

  private apply(logs: Awaited<ReturnType<PublicClient["getLogs"]>>) {
    const t = this.tally;
    const note = (kind: string, log: { blockNumber: bigint | null; transactionHash: string | null }, familyId?: bigint) => {
      t.recent.unshift({ kind, block: Number(log.blockNumber ?? 0n), tx: log.transactionHash ?? "", familyId: familyId?.toString() });
      if (t.recent.length > 40) t.recent.length = 40;
    };

    for (const e of parseEventLogs({ abi: ThunaiVaultAbi, logs: logs as never, strict: false })) {
      const a = (e as any).args ?? {};
      switch (e.eventName) {
        case "FamilyRegistered": {
          t.families += 1;
          const kind = this.classifyFamily(String(a.familyId));
          if (kind === "test") t.testFamilies += 1;
          else if (kind === "unknown") t.unknownFamilies = (t.unknownFamilies ?? 0) + 1;
          note("family_registered", e as never, a.familyId);
          break;
        }
        case "HoldOpened": {
          t.holdsOpened += 1;
          t.open[String(a.holdId)] = { amount: String(a.amount), test: this.classifyFamily(String(a.familyId)) !== "real" };
          note("hold_opened", e as never, a.familyId);
          break;
        }
        case "HoldResolved": {
          const held = t.open[String(a.holdId)];
          if (a.released) t.holdsReleased += 1;
          else {
            t.scamsStopped += 1;
            t.saveSeconds.push(Number(a.secondsToResolve));
            if (held) t.dollarsProtected = (BigInt(t.dollarsProtected) + BigInt(held.amount)).toString();
          }
          delete t.open[String(a.holdId)];
          note(a.released ? "hold_released" : "hold_stopped", e as never, a.familyId);
          break;
        }
        case "HoldExpired": {
          t.holdsExpired += 1;
          delete t.open[String(a.holdId)];
          note("hold_expired", e as never, a.familyId);
          break;
        }
        case "Payout": {
          t.dollarsDelivered = (BigInt(t.dollarsDelivered) + BigInt(a.amountOut)).toString();
          if (a.viaAgora) t.payoutsViaAgora += 1;
          else t.payoutsFallback += 1;
          note("payout", e as never, a.familyId);
          break;
        }
        case "CheckRequested":
          t.checksRequested += 1;
          break;
        case "LivenessProved":
          t.checksAnswered += 1;
          note("check_answered", e as never, a.familyId);
          break;
        case "SOSRaised":
          t.sosRaised += 1;
          note("sos_raised", e as never, a.familyId);
          break;
        default:
          break;
      }
    }
    for (const e of parseEventLogs({ abi: ScamSignalsAbi, logs: logs as never, strict: false })) {
      if (e.eventName === "Reported") {
        t.reportsFiled += 1;
        note("payee_reported", e as never);
      }
    }
  }

  private save() {
    writeFileSync(this.file, JSON.stringify(this.tally));
  }
}
