import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { TransactionEntity } from './transaction.entity';

@Entity({ name: 'transaction_receipts' })
export class TransactionReceiptEntity {
  @PrimaryColumn({ name: 'transaction_hash', type: 'varchar', length: 66 })
  transactionHash!: string;

  @OneToOne(() => TransactionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_hash', referencedColumnName: 'hash' })
  transaction!: TransactionEntity;

  @Index()
  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber!: string;

  @Column({ name: 'from_address', type: 'varchar', length: 42 })
  fromAddress!: string;

  @Column({ name: 'to_address', type: 'varchar', length: 42, nullable: true })
  toAddress!: string | null;

  @Column({
    name: 'contract_address',
    type: 'varchar',
    length: 42,
    nullable: true,
  })
  contractAddress!: string | null;

  @Column({ name: 'gas_used', type: 'numeric', precision: 78, scale: 0 })
  gasUsed!: string;

  @Column({
    name: 'cumulative_gas_used',
    type: 'numeric',
    precision: 78,
    scale: 0,
  })
  cumulativeGasUsed!: string;

  @Column({
    name: 'effective_gas_price',
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  effectiveGasPrice!: string | null;

  @Column({ type: 'integer' })
  status!: number;
}
