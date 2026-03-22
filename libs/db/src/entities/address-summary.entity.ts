import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'address_summaries' })
export class AddressSummaryEntity {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  address!: string;

  @Column({ name: 'transaction_count', type: 'integer', default: 0 })
  transactionCount!: number;

  @Column({ name: 'transfer_count', type: 'integer', default: 0 })
  transferCount!: number;

  @Column({ name: 'first_seen_block', type: 'bigint', nullable: true })
  firstSeenBlock!: string | null;

  @Column({ name: 'last_seen_block', type: 'bigint', nullable: true })
  lastSeenBlock!: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
