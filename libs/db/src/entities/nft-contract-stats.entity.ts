import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'nft_contract_stats' })
@Index(['lastActivityBlock'])
@Index(['uniqueHolders'])
@Index(['totalTransfers'])
export class NftContractStatsEntity {
  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @Column({ name: 'token_type', type: 'varchar', length: 10 })
  tokenType!: string;

  @Column({ name: 'total_transfers', type: 'integer', default: 0 })
  totalTransfers!: number;

  @Column({ name: 'unique_holders', type: 'integer', default: 0 })
  uniqueHolders!: number;

  @Column({ name: 'total_tokens_seen', type: 'integer', default: 0 })
  totalTokensSeen!: number;

  @Column({ name: 'last_activity_block', type: 'bigint', nullable: true })
  lastActivityBlock!: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
