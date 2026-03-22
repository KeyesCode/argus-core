import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'address_nft_holdings' })
@Index(['address', 'lastTransferBlock'])
@Index(['tokenAddress', 'tokenId'])
@Index(['address', 'tokenType'])
export class AddressNftHoldingEntity {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  address!: string;

  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @PrimaryColumn({ name: 'token_id', type: 'numeric', precision: 78, scale: 0 })
  tokenId!: string;

  @Column({ name: 'token_type', type: 'varchar', length: 10 })
  tokenType!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '1' })
  quantity!: string;

  @Column({ name: 'last_transfer_block', type: 'bigint' })
  lastTransferBlock!: string;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
