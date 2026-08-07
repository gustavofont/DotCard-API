import { Rarity } from '../common/enums/rarity.enum';
import { GameConfig, gameConfig, validateGameConfig } from './rarity.config';

describe('validateGameConfig', () => {
  it('accepts the real game config (sums to 100)', () => {
    expect(() => validateGameConfig(gameConfig)).not.toThrow();
  });

  it('throws when the rarity distribution sums to less than 100', () => {
    const broken: GameConfig = {
      ...gameConfig,
      rarityDistribution: {
        [Rarity.COMMON]: 60,
        [Rarity.RARE]: 25,
        [Rarity.EPIC]: 14,
        [Rarity.LEGENDARY]: 0,
      },
    };

    expect(() => validateGameConfig(broken)).toThrow(/must sum to exactly 100, got 99/);
  });

  it('throws when the rarity distribution sums to more than 100', () => {
    const broken: GameConfig = {
      ...gameConfig,
      rarityDistribution: {
        [Rarity.COMMON]: 60,
        [Rarity.RARE]: 25,
        [Rarity.EPIC]: 14,
        [Rarity.LEGENDARY]: 2,
      },
    };

    expect(() => validateGameConfig(broken)).toThrow(/must sum to exactly 100, got 101/);
  });
});
