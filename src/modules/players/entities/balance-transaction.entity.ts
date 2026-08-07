import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BalanceReason } from '../../../common/enums/balance-reason.enum';
import { bigintTransformer } from '../../../common/utils/bigint.transformer';

/**
 * Append-only ledger. Every change to players.balance writes a row here in
 * the same transaction — the balance itself is never trusted as the sole
 * source of truth for "what happened" (ESCOPO.md §5.8/§7).
 */
@Entity('balance_transactions')
@Index('IDX_BALANCE_TRANSACTIONS_USER_CREATED', ['userId', 'createdAt'])
export class BalanceTransaction {
  // pg returns generated bigint PKs as strings — kept as string (not run
  // through bigintTransformer) since IDs are opaque identifiers, not
  // arithmetic values; matches how large IDs are conventionally serialized
  // in JSON APIs to avoid client-side float precision issues.
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount!: number;

  @Column({ type: 'bigint', name: 'balance_after', transformer: bigintTransformer })
  balanceAfter!: number;

  @Column({ type: 'enum', enum: BalanceReason })
  reason!: BalanceReason;

  @Column({ type: 'uuid', name: 'pull_id', nullable: true })
  pullId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
