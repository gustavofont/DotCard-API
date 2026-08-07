import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/utils/bigint.transformer';

/**
 * user_id comes straight from AuthForge's JWT `sub` — no FK, since the two
 * services own independent databases (ESCOPO.md §2.4). The row is created
 * lazily on first access (see PlayersService.ensurePlayer).
 */
@Entity('players')
export class Player {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 8, unique: true, name: 'friend_code' })
  friendCode!: string;

  @Column({ type: 'varchar', length: 255, name: 'display_name' })
  displayName!: string;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance!: number;

  @Column({ type: 'timestamptz', name: 'last_allowance_at', nullable: true })
  lastAllowanceAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
