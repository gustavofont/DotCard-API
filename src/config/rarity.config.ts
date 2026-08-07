import { Rarity } from '../common/enums/rarity.enum';

export interface PackConfig {
  size: number;
  costInDotPoints: number;
}

export interface GameConfig {
  /** Percentage chance per rarity for the first step of the pull algorithm (ESCOPO.md §6). Must sum to exactly 100. */
  rarityDistribution: Record<Rarity, number>;
  /** Allowed pack sizes and their cost. Currently linear (1 DotPoint/card, ESCOPO.md §7), kept as a table instead of a formula so volume pricing is a config-only change later. */
  packs: PackConfig[];
  /** Credited once, automatically, when a player row is first created (INITIAL_GRANT). */
  initialBalance: number;
  /** Credited per successful POST /me/daily-reward/claim, added to the current balance with no cap (ESCOPO.md §7). */
  dailyRewardAmount: number;
}

export const gameConfig: GameConfig = {
  rarityDistribution: {
    [Rarity.COMMON]: 60,
    [Rarity.RARE]: 25,
    [Rarity.EPIC]: 14,
    [Rarity.LEGENDARY]: 1,
  },
  packs: [
    { size: 1, costInDotPoints: 1 },
    { size: 5, costInDotPoints: 5 },
    { size: 10, costInDotPoints: 10 },
  ],
  initialBalance: 10,
  dailyRewardAmount: 10,
};

/**
 * Fail-fast on boot (same principle as env.validation.ts): a rarity
 * distribution that doesn't sum to 100 makes "legendary = 1%" a lie, so the
 * app must refuse to start rather than silently sorting with wrong odds.
 */
export function validateGameConfig(config: GameConfig): void {
  const sum = Object.values(config.rarityDistribution).reduce(
    (total, percentage) => total + percentage,
    0,
  );

  if (sum !== 100) {
    throw new Error(
      `Invalid game config: rarity.rarityDistribution must sum to exactly 100, got ${sum}.`,
    );
  }
}
