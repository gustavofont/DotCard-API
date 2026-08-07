import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BalanceReason } from '../../../common/enums/balance-reason.enum';
import { InsufficientBalanceException } from '../../../common/exceptions/business.exceptions';
import { BalanceTransaction } from '../entities/balance-transaction.entity';
import { Player } from '../entities/player.entity';

export interface DebitOptions {
  /** Groups this debit with the pull it paid for (ESCOPO.md §5.8). */
  pullId?: string;
  /**
   * Lets the caller compose this debit into a larger transaction (e.g. the
   * pull transaction in Phase 4, which debits and generates cards in one
   * commit). Opens its own transaction when omitted.
   */
  manager?: EntityManager;
}

/**
 * Only debits — never applies the daily allowance. Claiming the daily
 * reward is a separate, explicit action (ESCOPO.md §7) owned by
 * PlayersController/PlayersService, not this service.
 */
@Injectable()
export class WalletService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async debit(
    userId: string,
    amount: number,
    reason: BalanceReason,
    options: DebitOptions = {},
  ): Promise<Player> {
    const run = (manager: EntityManager): Promise<Player> =>
      this.debitWithManager(manager, userId, amount, reason, options.pullId);

    if (options.manager) {
      return run(options.manager);
    }
    return this.dataSource.transaction(run);
  }

  private async debitWithManager(
    manager: EntityManager,
    userId: string,
    amount: number,
    reason: BalanceReason,
    pullId?: string,
  ): Promise<Player> {
    const player = await manager.findOne(Player, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!player) {
      throw new NotFoundException(`Player ${userId} not found.`);
    }
    if (player.balance < amount) {
      throw new InsufficientBalanceException(amount, player.balance);
    }

    player.balance -= amount;
    await manager.save(player);

    await manager.insert(BalanceTransaction, {
      userId,
      amount: -amount,
      balanceAfter: player.balance,
      reason,
      pullId: pullId ?? null,
    });

    return player;
  }
}
