/**
 * Thunai event handlers.
 *
 * These power three things the product cannot fake: the live feed both roles watch, the
 * evidence line on a hold card, and the public "families protected" counter. Every number
 * exposed here is derived from an event the contract actually emitted, so anything on
 * screen can be audited against the chain.
 */
import {
  ThunaiVault,
  ScamSignals,
  type Family,
  type NetworkStats,
} from "generated";

const GLOBAL = "global";

const HOLD_REASON_NAME: Record<number, string> = {
  0: "NONE",
  1: "NEW_PAYEE",
  2: "OVER_CAP",
  3: "UNSCHEDULED",
  4: "NETWORK_FLAG",
  5: "CHECK_PENDING",
  6: "FROZEN",
};

const EMPTY_STATS: NetworkStats = {
  id: GLOBAL,
  families: 0,
  holdsOpened: 0,
  scamsStopped: 0,
  holdsExpired: 0,
  dollarsProtected: 0n,
  dollarsDelivered: 0n,
  payoutsViaAgora: 0,
  payoutsFallback: 0,
  checksRequested: 0,
  checksAnswered: 0,
  reportsFiled: 0,
  sosRaised: 0,
  medianSaveSeconds: 0,
  fastestSaveSeconds: 0,
  saveSeconds: [],
  updatedAt: 0n,
};

/** Reads the single stats row, creating it on first use. */
async function stats(context: any): Promise<NetworkStats> {
  return (await context.NetworkStats.get(GLOBAL)) ?? EMPTY_STATS;
}

/**
 * True median, recomputed from the stored list.
 *
 * A running average would be the easy option and the wrong one: one slow save (a parent
 * asleep for six hours) would drag the headline number far from what families actually
 * experience. The median is the honest summary, so the full list is kept.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

// --------------------------------------------------------------- onboarding

ThunaiVault.FamilyRegistered.handler(async ({ event, context }) => {
  const family: Family = {
    id: event.params.familyId.toString(),
    student: event.params.studentAcct,
    guardian: event.params.guardianAcct,
    createdAt: BigInt(event.block.timestamp),
    balance: 0n,
    homeBalance: 0n,
    weeklyAmount: 0n,
    perWithdrawalCap: 0n,
    cadence: 0n,
    nextRunAt: 0n,
    frozen: false,
    totalReceived: 0n,
    totalHeld: 0n,
    scamsStopped: 0,
    studentNotesVersion: 0,
    guardianNotesVersion: 0,
  };
  context.Family.set(family);

  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    families: s.families + 1,
    updatedAt: BigInt(event.block.timestamp),
  });
});

ThunaiVault.EnvelopeSet.handler(async ({ event, context }) => {
  const id = event.params.familyId.toString();
  const family = await context.Family.get(id);
  if (!family) return;
  context.Family.set({
    ...family,
    weeklyAmount: event.params.weeklyAmount,
    perWithdrawalCap: event.params.perWithdrawalCap,
    cadence: event.params.cadence,
    nextRunAt: event.params.nextRunAt,
  });
});

// ------------------------------------------------------------------ funding

ThunaiVault.Funded.handler(async ({ event, context }) => {
  const id = event.params.familyId.toString();
  const family = await context.Family.get(id);
  if (!family) return;
  context.Family.set({ ...family, homeBalance: event.params.homeBalance });
});

/** The allowance arriving. This is the "Sunday $150 from Amma arrived" row. */
ThunaiVault.Payout.handler(async ({ event, context }) => {
  const id = event.params.familyId.toString();

  context.Payout.set({
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    family_id: id,
    amountIn: event.params.amountIn,
    amountOut: event.params.amountOut,
    viaAgora: event.params.viaAgora,
    timestamp: event.params.timestamp,
    blockNumber: BigInt(event.block.number),
    txHash: event.transaction.hash,
  });

  const family = await context.Family.get(id);
  if (family) {
    context.Family.set({
      ...family,
      balance: family.balance + event.params.amountOut,
      homeBalance:
        family.homeBalance > event.params.amountIn
          ? family.homeBalance - event.params.amountIn
          : 0n,
      totalReceived: family.totalReceived + event.params.amountOut,
    });
  }

  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    dollarsDelivered: s.dollarsDelivered + event.params.amountOut,
    // Recorded separately so the write-up can state exactly how many settlements went
    // through Agora rather than the disclosed fallback.
    payoutsViaAgora: s.payoutsViaAgora + (event.params.viaAgora ? 1 : 0),
    payoutsFallback: s.payoutsFallback + (event.params.viaAgora ? 0 : 1),
    updatedAt: BigInt(event.block.timestamp),
  });
});

// -------------------------------------------------------------------- holds

/** The moment the money stops. Everything the alert needs is in this one event. */
ThunaiVault.HoldOpened.handler(async ({ event, context }) => {
  const familyId = event.params.familyId.toString();
  const reason = Number(event.params.reason);

  context.Hold.set({
    id: event.params.holdId.toString(),
    family_id: familyId,
    to: event.params.to,
    amount: event.params.amount,
    reason,
    reasonName: HOLD_REASON_NAME[reason] ?? "UNKNOWN",
    scriptId: undefined,
    status: "OPEN",
    memoHash: event.params.memoHash,
    openedAt: BigInt(event.block.timestamp),
    releaseAt: event.params.releaseAt,
    resolvedAt: undefined,
    secondsToResolve: undefined,
    stoppedByGuardian: false,
    txHash: event.transaction.hash,
  });

  const family = await context.Family.get(familyId);
  if (family) {
    context.Family.set({
      ...family,
      // Escrowed: out of the spendable balance, and never at the payee.
      balance: family.balance > event.params.amount ? family.balance - event.params.amount : 0n,
      totalHeld: family.totalHeld + event.params.amount,
    });
  }

  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    holdsOpened: s.holdsOpened + 1,
    updatedAt: BigInt(event.block.timestamp),
  });
});

/** The guardian decided. A cancel is a save; a release is a payment they approved. */
ThunaiVault.HoldResolved.handler(async ({ event, context }) => {
  const holdId = event.params.holdId.toString();
  const hold = await context.Hold.get(holdId);
  if (!hold) return;

  const cancelled = !event.params.released;
  const seconds = Number(event.params.secondsToResolve);

  context.Hold.set({
    ...hold,
    status: cancelled ? "CANCELLED" : "RELEASED",
    resolvedAt: BigInt(event.block.timestamp),
    secondsToResolve: seconds,
    stoppedByGuardian: cancelled,
  });

  const family = await context.Family.get(hold.family_id);
  if (family) {
    context.Family.set({
      ...family,
      // A cancel returns the money to the student; a release pays the payee.
      balance: cancelled ? family.balance + hold.amount : family.balance,
      scamsStopped: cancelled ? family.scamsStopped + 1 : family.scamsStopped,
    });
  }

  const s = await stats(context);
  // Only a save counts toward the save-time distribution. Timing how long it took a
  // parent to approve her own son's rent would flatter the median for no reason.
  const saveSeconds = cancelled ? [...s.saveSeconds, seconds] : [...s.saveSeconds];
  context.NetworkStats.set({
    ...s,
    scamsStopped: s.scamsStopped + (cancelled ? 1 : 0),
    dollarsProtected: cancelled ? s.dollarsProtected + hold.amount : s.dollarsProtected,
    saveSeconds,
    medianSaveSeconds: median(saveSeconds),
    fastestSaveSeconds:
      saveSeconds.length === 0 ? 0 : Math.min(...saveSeconds),
    updatedAt: BigInt(event.block.timestamp),
  });
});

/** Nobody answered, so the money went back by itself. The fail-safe, recorded. */
ThunaiVault.HoldExpired.handler(async ({ event, context }) => {
  const holdId = event.params.holdId.toString();
  const hold = await context.Hold.get(holdId);
  if (!hold) return;

  context.Hold.set({
    ...hold,
    status: "EXPIRED",
    resolvedAt: BigInt(event.block.timestamp),
    secondsToResolve: Number(BigInt(event.block.timestamp) - hold.openedAt),
  });

  const family = await context.Family.get(hold.family_id);
  if (family) {
    context.Family.set({ ...family, balance: family.balance + event.params.amount });
  }

  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    holdsExpired: s.holdsExpired + 1,
    updatedAt: BigInt(event.block.timestamp),
  });
});

ThunaiVault.Withdrawn.handler(async ({ event, context }) => {
  context.Withdrawal.set({
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    family_id: event.params.familyId.toString(),
    to: event.params.to,
    amount: event.params.amount,
    memoHash: event.params.memoHash,
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
  });
});

// ------------------------------------------------------- check on the child

ThunaiVault.CheckRequested.handler(async ({ event, context }) => {
  const familyId = event.params.familyId.toString();
  context.Check.set({
    id: `${familyId}_${event.params.nonce.toString()}`,
    family_id: familyId,
    nonce: event.params.nonce,
    requestedAt: event.params.requestedAt,
    provedAt: undefined,
    latencySeconds: undefined,
    answered: false,
  });

  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    checksRequested: s.checksRequested + 1,
    updatedAt: BigInt(event.block.timestamp),
  });
});

/** "Signed on Arjun's phone, 0.9s ago." A voice can be cloned; this cannot. */
ThunaiVault.LivenessProved.handler(async ({ event, context }) => {
  const familyId = event.params.familyId.toString();
  const id = `${familyId}_${event.params.nonce.toString()}`;
  const check = await context.Check.get(id);
  if (check) {
    context.Check.set({
      ...check,
      provedAt: event.params.timestamp,
      latencySeconds: Number(event.params.latencySeconds),
      answered: true,
    });
  }

  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    checksAnswered: s.checksAnswered + 1,
    updatedAt: BigInt(event.block.timestamp),
  });
});

// ------------------------------------------------------------------ freeze

ThunaiVault.Frozen.handler(async ({ event, context }) => {
  const family = await context.Family.get(event.params.familyId.toString());
  if (family) context.Family.set({ ...family, frozen: true });
});

ThunaiVault.Unfrozen.handler(async ({ event, context }) => {
  const family = await context.Family.get(event.params.familyId.toString());
  if (family) context.Family.set({ ...family, frozen: false });
});

// ------------------------------------------------------------ silent SOS

/**
 * The student pressed Silent SOS. The family is frozen in the same transaction (the Frozen event
 * handler above sets that), so this only records the SOS and counts it.
 */
ThunaiVault.SOSRaised.handler(async ({ event, context }) => {
  const familyId = event.params.familyId.toString();
  context.Sos.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    family_id: familyId,
    reasonCode: Number(event.params.reasonCode),
    timestamp: BigInt(event.params.timestamp),
  });
  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    sosRaised: s.sosRaised + 1,
    updatedAt: BigInt(event.block.timestamp),
  });
});

// --------------------------------------------------------- encrypted notes

/** Only the version moves. The ciphertext stays in the contract, and nothing here can read it. */
ThunaiVault.NotesStored.handler(async ({ event, context }) => {
  const family = await context.Family.get(event.params.familyId.toString());
  if (!family) return;
  const version = Number(event.params.version);
  context.Family.set(
    Number(event.params.role) === 0
      ? { ...family, studentNotesVersion: version }
      : { ...family, guardianNotesVersion: version },
  );
});

// ----------------------------------------------------------- the network

/**
 * A family confirmed a scam.
 *
 * This is what another family's hold card reads when it says "1 verified family reported
 * this number, 2 minutes ago". The count only ever raises the hold level; it never
 * refuses a payment on its own, and a payee on a family's own signed schedule is immune.
 */
ScamSignals.Reported.handler(async ({ event, context }) => {
  const handleHash = event.params.handleHash;
  const existing = await context.Signal.get(handleHash);

  context.Signal.set({
    id: handleHash,
    handleHash,
    // Taken from the contract's own counter rather than incremented locally, so a
    // replayed or reordered log can never inflate it.
    reports: Number(event.params.reports),
    lastAt: BigInt(event.block.timestamp),
    scriptId: Number(event.params.scriptId),
    rebuttals: existing?.rebuttals ?? [],
    firstReportedAt: existing?.firstReportedAt ?? BigInt(event.block.timestamp),
  });

  // Label the hold that produced the report, so the feed can show what it was.
  const hold = await context.Hold.get(event.params.holdId.toString());
  if (hold) {
    context.Hold.set({ ...hold, scriptId: Number(event.params.scriptId) });
  }

  const s = await stats(context);
  context.NetworkStats.set({
    ...s,
    reportsFiled: s.reportsFiled + 1,
    updatedAt: BigInt(event.block.timestamp),
  });
});

/** The flagged party's response. Appended, never used to silence a report. */
ScamSignals.Rebutted.handler(async ({ event, context }) => {
  const existing = await context.Signal.get(event.params.handleHash);
  if (!existing) return;
  context.Signal.set({
    ...existing,
    rebuttals: [...existing.rebuttals, event.params.uri],
  });
});
