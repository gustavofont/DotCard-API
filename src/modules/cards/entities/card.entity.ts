import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CardType } from '../../../common/enums/card-type.enum';
import { Rarity } from '../../../common/enums/rarity.enum';
import { Collection } from './collection.entity';

/**
 * Composite index matches the pull algorithm's query shape exactly:
 * "uniformly pick a card of rarity X within collection Y" (ESCOPO.md §5.2/§6).
 */
@Entity('cards')
@Index('IDX_CARDS_COLLECTION_RARITY', ['collectionId', 'rarity'])
export class Card {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: CardType })
  type!: CardType;

  @Column({ type: 'int', name: 'collection_id' })
  collectionId!: number;

  @ManyToOne(() => Collection)
  @JoinColumn({ name: 'collection_id' })
  collection!: Collection;

  @Column({ type: 'enum', enum: Rarity })
  rarity!: Rarity;

  @Column({ type: 'varchar', length: 512, name: 'image_key', nullable: true })
  imageKey!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
