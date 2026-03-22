import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'token_transfers' })
@Index(['tokenAddress'])
@Index(['fromAddress'])
@Index(['toAddress'])
@Index(['blockNumber'])
@Index(['transactionHash', 'logIndex'], { unique: true })
export class TokenTransferEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'transaction_hash', type: 'varchar', length: 66 })
  transactionHash!: string;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber!: string;

  @Column({ name: 'log_index', type: 'integer' })
  logIndex!: number;

  @Column({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @Column({ name: 'from_address', type: 'varchar', length: 42 })
  fromAddress!: string;

  @Column({ name: 'to_address', type: 'varchar', length: 42 })
  toAddress!: string;

  @Column({ name: 'amount_raw', type: 'numeric', precision: 78, scale: 0 })
  amountRaw!: string;
}
