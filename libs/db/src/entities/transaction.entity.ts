import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { BlockEntity } from './block.entity';

@Entity({ name: 'transactions' })
@Index(['blockNumber', 'transactionIndex'], { unique: true })
export class TransactionEntity {
  @PrimaryColumn({ type: 'varchar', length: 66 })
  hash!: string;

  @Index()
  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber!: string;

  @ManyToOne(() => BlockEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_number', referencedColumnName: 'number' })
  block!: BlockEntity;

  @Column({ name: 'transaction_index', type: 'integer' })
  transactionIndex!: number;

  @Index()
  @Column({ name: 'from_address', type: 'varchar', length: 42 })
  fromAddress!: string;

  @Index()
  @Column({ name: 'to_address', type: 'varchar', length: 42, nullable: true })
  toAddress!: string | null;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  value!: string;

  @Column({ name: 'input_data', type: 'text' })
  inputData!: string;

  @Column({ type: 'bigint' })
  nonce!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  gas!: string;

  @Column({
    name: 'gas_price',
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  gasPrice!: string | null;

  @Column({
    name: 'max_fee_per_gas',
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  maxFeePerGas!: string | null;

  @Column({
    name: 'max_priority_fee_per_gas',
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  maxPriorityFeePerGas!: string | null;

  @Column({ type: 'integer', nullable: true })
  type!: number | null;
}
