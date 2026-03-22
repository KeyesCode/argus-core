import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'blocks' })
export class BlockEntity {
  @PrimaryColumn({ type: 'bigint' })
  number!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 66 })
  hash!: string;

  @Column({ name: 'parent_hash', type: 'varchar', length: 66 })
  parentHash!: string;

  @Index()
  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @Column({ name: 'gas_limit', type: 'numeric', precision: 78, scale: 0 })
  gasLimit!: string;

  @Column({ name: 'gas_used', type: 'numeric', precision: 78, scale: 0 })
  gasUsed!: string;

  @Column({
    name: 'base_fee_per_gas',
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  baseFeePerGas!: string | null;

  @Column({ type: 'varchar', length: 42, nullable: true })
  miner!: string | null;
}
