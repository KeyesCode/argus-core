import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum NftMetadataStatus {
  PENDING = 'pending',
  FETCHING = 'fetching',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYABLE = 'retryable',
}

@Entity({ name: 'nft_token_metadata' })
@Index(['fetchStatus'])
export class NftTokenMetadataEntity {
  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @PrimaryColumn({ name: 'token_id', type: 'numeric', precision: 78, scale: 0 })
  tokenId!: string;

  @Column({ name: 'token_uri', type: 'text', nullable: true })
  tokenUri!: string | null;

  @Column({ name: 'metadata_json', type: 'jsonb', nullable: true })
  metadataJson!: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({
    name: 'fetch_status',
    type: 'varchar',
    length: 20,
    default: NftMetadataStatus.PENDING,
  })
  fetchStatus!: string;

  @Column({ name: 'fetch_attempts', type: 'integer', default: 0 })
  fetchAttempts!: number;

  @Column({ name: 'last_fetch_at', type: 'timestamptz', nullable: true })
  lastFetchAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
