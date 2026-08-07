/**
 * Claim eligibility is a UTC calendar-day cutoff, not a rolling 24h window
 * since the last claim (ESCOPO.md §7) — simpler for players to reason about
 * ("resets at UTC midnight"), at the cost of a harmless few-minute window
 * around the boundary.
 */
export function startOfUtcDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function isDailyRewardAvailable(
  lastAllowanceAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastAllowanceAt) {
    return true;
  }
  return lastAllowanceAt < startOfUtcDay(now);
}
