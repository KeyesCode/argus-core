import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'token_stats' })
export class TokenStatsEntity {
  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @Column({ name: 'transfer_count', type: 'integer', default: 0 })
  transferCount!: number;

  @Column({ name: 'holder_count', type: 'integer', default: 0 })
  holderCount!: number;

  @Column({ name: 'last_activity_block', type: 'bigint', nullable: true })
  lastActivityBlock!: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
