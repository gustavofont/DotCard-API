/**
 * Single source of truth for card rarity, shared with the pull probability
 * config (rarity.config.ts, added in Phase 3) — the two must never drift
 * apart, since the sum of configured probabilities must cover exactly
 * these values.
 */
export enum Rarity {
  COMMON = 'COMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}
