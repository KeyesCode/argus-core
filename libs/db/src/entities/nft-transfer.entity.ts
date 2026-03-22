import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'nft_transfers' })
@Index(['transactionHash', 'logIndex'], { unique: true })
@Index(['tokenAddress'])
@Index(['fromAddress'])
@Index(['toAddress'])
@Index(['blockNumber'])
@Index(['tokenAddress', 'tokenId'])
export class NftTransferEntity {
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

  @Column({ name: 'token_type', type: 'varchar', length: 10 })
  tokenType!: string; // 'ERC721' | 'ERC1155'

  @Column({ name: 'from_address', type: 'varchar', length: 42 })
  fromAddress!: string;

  @Column({ name: 'to_address', type: 'varchar', length: 42 })
  toAddress!: string;

  @Column({ name: 'token_id', type: 'numeric', precision: 78, scale: 0 })
  tokenId!: string;

  @Column({ name: 'quantity', type: 'numeric', precision: 78, scale: 0, default: '1' })
  quantity!: string;

  @Column({ name: 'operator', type: 'varchar', length: 42, nullable: true })
  operator!: string | null;
}
