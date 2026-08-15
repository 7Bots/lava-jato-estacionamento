// Pure billing engine. Every screen must use this — never duplicate the math.

export type BillingInput = {
  checkinAt: Date;
  checkoutAt: Date;
  priceBlockCents: number;
  dailyCents: number;
  blockMinutes: number;
  graceMinutes: number;
  forceDaily: boolean;
  manualDiscountCents: number;
};

export type BillingResult = {
  elapsedMs: number;
  blocksCharged: number;
  daysCharged: number;
  subtotalCents: number;
  totalCents: number;
  isDailyApplied: boolean;
  nextBlockAt: Date | null;
  msToNextBlock: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeBilling(input: BillingInput): BillingResult {
  const {
    checkinAt,
    checkoutAt,
    priceBlockCents,
    dailyCents,
    blockMinutes,
    graceMinutes,
    forceDaily,
    manualDiscountCents,
  } = input;

  const elapsedMs = Math.max(0, checkoutAt.getTime() - checkinAt.getTime());
  const graceMs = Math.max(0, graceMinutes) * 60_000;
  const blockMs = Math.max(1, blockMinutes) * 60_000;

  if (elapsedMs <= graceMs) {
    const nextBlockAt = new Date(checkinAt.getTime() + graceMs + blockMs);
    return {
      elapsedMs,
      blocksCharged: 0,
      daysCharged: 0,
      subtotalCents: 0,
      totalCents: 0,
      isDailyApplied: false,
      nextBlockAt,
      msToNextBlock: nextBlockAt.getTime() - checkoutAt.getTime(),
    };
  }

  const daysCharged = Math.floor(elapsedMs / DAY_MS);
  const remainderMs = elapsedMs - daysCharged * DAY_MS;

  const billableRemainder = remainderMs - graceMs;
  const blocksCharged =
    billableRemainder > 0 ? Math.max(1, Math.ceil(billableRemainder / blockMs)) : 0;

  const rawRemainderCost = blocksCharged * priceBlockCents;
  const remainderCost = Math.min(rawRemainderCost, dailyCents);

  let subtotalCents = daysCharged * dailyCents + remainderCost;
  if (forceDaily) {
    subtotalCents = Math.max(subtotalCents, (daysCharged + 1) * dailyCents);
  }

  const totalCents = Math.max(0, subtotalCents - Math.max(0, manualDiscountCents));
  const capReached = rawRemainderCost >= dailyCents;
  const isDailyApplied = forceDaily || daysCharged > 0 || capReached;

  let nextBlockAt: Date | null = null;
  if (!capReached && !forceDaily) {
    const base = checkinAt.getTime() + daysCharged * DAY_MS + graceMs;
    nextBlockAt = new Date(base + Math.max(1, blocksCharged) * blockMs);
  }

  return {
    elapsedMs,
    blocksCharged,
    daysCharged,
    subtotalCents,
    totalCents,
    isDailyApplied,
    nextBlockAt,
    msToNextBlock: nextBlockAt ? nextBlockAt.getTime() - checkoutAt.getTime() : null,
  };
}

/** Progress (0..1) inside the current billing block. */
export function blockProgress(result: BillingResult, blockMinutes: number): number {
  if (result.msToNextBlock == null) return 1;
  const blockMs = Math.max(1, blockMinutes) * 60_000;
  return Math.min(1, Math.max(0, 1 - result.msToNextBlock / blockMs));
}
