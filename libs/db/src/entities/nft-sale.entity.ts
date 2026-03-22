import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'nft_sales' })
@Index(['transactionHash', 'logIndex'], { unique: true })
@Index(['collectionAddress', 'blockNumber'])
@Index(['sellerAddress', 'blockNumber'])
@Index(['buyerAddress', 'blockNumber'])
@Index(['blockNumber'])
@Index(['protocolName'])
export class NftSaleEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'protocol_name', type: 'varchar', length: 50 })
  protocolName!: string;

  @Column({ name: 'transaction_hash', type: 'varchar', length: 66 })
  transactionHash!: string;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber!: string;

  @Column({ name: 'log_index', type: 'integer' })
  logIndex!: number;

  @Column({ name: 'order_hash', type: 'varchar', length: 66, nullable: true })
  orderHash!: string | null;

  @Column({ name: 'collection_address', type: 'varchar', length: 42 })
  collectionAddress!: string;

  @Column({ name: 'token_id', type: 'numeric', precision: 78, scale: 0 })
  tokenId!: string;

  @Column({ name: 'token_standard', type: 'varchar', length: 10 })
  tokenStandard!: string; // 'ERC721' | 'ERC1155'

  @Column({ name: 'quantity', type: 'numeric', precision: 78, scale: 0, default: '1' })
  quantity!: string;

  @Column({ name: 'seller_address', type: 'varchar', length: 42 })
  sellerAddress!: string;

  @Column({ name: 'buyer_address', type: 'varchar', length: 42 })
  buyerAddress!: string;

  @Column({ name: 'payment_token', type: 'varchar', length: 42 })
  paymentToken!: string; // 0x0 for ETH

  @Column({ name: 'total_price', type: 'numeric', precision: 78, scale: 0 })
  totalPrice!: string;
}
