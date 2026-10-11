import { HOLD_STATUS } from "@thunai/shared";
import type { VaultService } from "@thunai/evm";

/**
 * The keeper: the only part of Companion that acts without a person.
 *
 * It does exactly two things, both of which the contract would let any stranger do:
 *
 *   1. `runAllowance` for families whose signed envelope is due,
 *   2. `expireHold` for holds nobody answered.
 *
 * Both are safe by construction. The allowance runs the envelope the guardian already
 * signed, or reverts. Expiry always returns money to the student and can never pay a
 * payee. So the keeper holds MON for gas and no authority at all: if it dies, allowances
 * are late and holds sit until someone calls expiry, but nothing can be lost.
 */

export type KeeperOptions = {
  vault: VaultService;
  intervalMs: number;
  log: {
    info: (...a: any[]) => void;
    warn: (...a: any[]) => void;
    error: (...a: any[]) => void;
  };
  /** When it returns false the timer's sweep is skipped (another orchestrator is in charge). */
  gate?: () => boolean;
  /** Called after a hold expires, so the family can be told their money came back. */
  onHoldExpired?: (holdId: bigint, familyId: bigint, amount: bigint) => void;
};

export class Keeper {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private lastTickAt = 0;
  private stats = { allowancesRun: 0, holdsExpired: 0, errors: 0 };

  constructor(private readonly options: KeeperOptions) {}

  start() {
    if (this.timer) return;
    this.options.log.info({ everyMs: this.options.intervalMs }, "keeper started");
    // Run once immediately so a restart mid-demo catches up at once.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  status() {
    return { ...this.stats, lastTickAt: this.lastTickAt, running: this.running };
  }

  /** One sweep. Overlapping runs are skipped so a slow RPC cannot double-send. */
  async tick(force = false) {
    if (!force && this.options.gate && !this.options.gate()) return;
    if (force) {
      // A forced sweep (the admin route, used by tests and demos) must really run: wait for a sweep already in
      // progress instead of silently skipping, because that sweep may have started before the hold was due.
      for (let waited = 0; this.running && waited < 120_000; waited += 250) await new Promise((r) => setTimeout(r, 250));
    }
    if (this.running) return;
    this.running = true;
    this.lastTickAt = Date.now();
    try {
      await this.runDueAllowances();
      await this.expireTimedOutHolds();
    } catch (error) {
      this.stats.errors++;
      this.options.log.error({ err: (error as Error).message }, "keeper sweep failed");
    } finally {
      this.running = false;
    }
  }

  private async runDueAllowances() {
    const count = await this.options.vault.familyCount();
    for (let familyId = 1n; familyId <= count; familyId++) {
      try {
        if (!(await this.options.vault.allowanceDue(familyId))) continue;
        const tx = await this.options.vault.runAllowance(familyId);
        this.stats.allowancesRun++;
        this.options.log.info(
          { familyId: String(familyId), txHash: tx.hash, latencyMs: Math.round(tx.latencyMs) },
          "allowance sent",
        );
      } catch (error) {
        // One family's problem must not stop every other family's allowance.
        this.stats.errors++;
        this.options.log.warn(
          { familyId: String(familyId), err: (error as Error).message },
          "allowance run failed",
        );
      }
    }
  }

  private async expireTimedOutHolds() {
    const count = await this.options.vault.holdCount();
    // The chain's clock, not this host's: that is what the contract compares against.
    const now = await this.options.vault.latestBlockTimestamp();

    // Walk backwards: open holds are overwhelmingly recent, so this finds them first and
    // stops as soon as it has seen a long stretch of settled ones.
    let settledStreak = 0;
    for (let holdId = count; holdId >= 1n; holdId--) {
      let hold;
      try {
        hold = await this.options.vault.readHold(holdId);
      } catch {
        continue;
      }

      if (hold.status !== HOLD_STATUS.OPEN) {
        if (++settledStreak > 50) break;
        continue;
      }
      settledStreak = 0;

      if (now < hold.releaseAt) continue;

      try {
        await this.options.vault.expireHold(holdId);
        this.stats.holdsExpired++;
        this.options.log.info(
          { holdId: String(holdId), familyId: String(hold.familyId) },
          "hold expired: money returned to the student",
        );
        this.options.onHoldExpired?.(holdId, hold.familyId, hold.amount);
      } catch (error) {
        // Most likely someone else expired it first, which is a fine outcome.
        this.options.log.warn(
          { holdId: String(holdId), err: (error as Error).message },
          "expireHold failed (it may already be settled)",
        );
      }
    }
  }
}
