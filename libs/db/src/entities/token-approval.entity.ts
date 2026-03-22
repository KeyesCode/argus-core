import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'token_approvals' })
@Index(['transactionHash', 'logIndex'], { unique: true })
@Index(['ownerAddress', 'blockNumber'])
@Index(['spenderAddress', 'blockNumber'])
@Index(['tokenAddress', 'blockNumber'])
@Index(['ownerAddress', 'tokenAddress'])
export class TokenApprovalEntity {
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

  @Column({ name: 'owner_address', type: 'varchar', length: 42 })
  ownerAddress!: string;

  @Column({ name: 'spender_address', type: 'varchar', length: 42 })
  spenderAddress!: string;

  @Column({ name: 'value_raw', type: 'numeric', precision: 78, scale: 0 })
  valueRaw!: string;
}
