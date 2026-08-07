import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { BalanceReason } from '../../../common/enums/balance-reason.enum';
import { DailyRewardAlreadyClaimedException } from '../../../common/exceptions/business.exceptions';
import { AppConfig } from '../../../config/configuration';
import { BalanceTransaction } from '../entities/balance-transaction.entity';
import { Player } from '../entities/player.entity';
import { isDailyRewardAvailable } from '../utils/daily-reward.util';
import { generateFriendCode } from '../utils/friend-code.util';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const FRIEND_CODE_GENERATION_ATTEMPTS = 5;

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    @InjectRepository(Player) private readonly playerRepository: Repository<Player>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Creates the player row on first access (ESCOPO.md §5.4) and keeps
   * display_name synced on every call — the JWT is the only place a
   * user's current name is known, so this is called from every /me
   * handler rather than a single "register" endpoint.
   */
  async ensurePlayer(userId: string, displayName: string): Promise<Player> {
    const existing = await this.playerRepository.findOne({ where: { userId } });
    if (existing) {
      return this.syncDisplayName(existing, displayName);
    }

    try {
      return await this.createPlayer(userId, displayName);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        // Lost a race with a concurrent first request for the same user —
        // the winner's row already exists, just use it.
        const player = await this.playerRepository.findOneByOrFail({ userId });
        return this.syncDisplayName(player, displayName);
      }
      throw error;
    }
  }

  /**
   * Explicit action, not applied automatically anywhere else (ESCOPO.md
   * §7) — credits +10 to the current balance, uncapped, once per UTC
   * calendar day.
   */
  async claimDailyReward(userId: string): Promise<{ player: Player; credited: number }> {
    const { dailyRewardAmount } = this.configService.get('game', { infer: true });

    return this.dataSource.transaction(async (manager) => {
      const player = await manager.findOne(Player, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!player) {
        throw new Error(`Player ${userId} not found — ensurePlayer must run before claiming.`);
      }
      if (!isDailyRewardAvailable(player.lastAllowanceAt)) {
        throw new DailyRewardAlreadyClaimedException();
      }

      player.balance += dailyRewardAmount;
      player.lastAllowanceAt = new Date();
      await manager.save(player);

      await manager.insert(BalanceTransaction, {
        userId,
        amount: dailyRewardAmount,
        balanceAfter: player.balance,
        reason: BalanceReason.DAILY_ALLOWANCE,
      });

      return { player, credited: dailyRewardAmount };
    });
  }

  async rotateFriendCode(userId: string): Promise<Player> {
    return this.dataSource.transaction(async (manager) => {
      const player = await manager.findOne(Player, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!player) {
        throw new Error(`Player ${userId} not found — ensurePlayer must run before rotating.`);
      }

      player.friendCode = await this.generateUniqueFriendCode(manager);
      return manager.save(player);
    });
  }

  private async syncDisplayName(player: Player, displayName: string): Promise<Player> {
    if (player.displayName === displayName) {
      return player;
    }
    player.displayName = displayName;
    return this.playerRepository.save(player);
  }

  private async createPlayer(userId: string, displayName: string): Promise<Player> {
    const { initialBalance } = this.configService.get('game', { infer: true });

    return this.dataSource.transaction(async (manager) => {
      const friendCode = await this.generateUniqueFriendCode(manager);

      const player = await manager.save(
        manager.create(Player, {
          userId,
          friendCode,
          displayName,
          balance: initialBalance,
        }),
      );

      await manager.insert(BalanceTransaction, {
        userId,
        amount: initialBalance,
        balanceAfter: initialBalance,
        reason: BalanceReason.INITIAL_GRANT,
      });

      return player;
    });
  }

  private async generateUniqueFriendCode(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < FRIEND_CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = generateFriendCode();
      const exists = await manager.exists(Player, { where: { friendCode: code } });
      if (!exists) {
        return code;
      }
      this.logger.warn(`friend_code collision on attempt ${attempt + 1}, retrying`);
    }
    throw new Error('Could not generate a unique friend code after several attempts.');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
