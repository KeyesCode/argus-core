import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Current ownership state for NFTs.
 * - ERC-721: one row per (token_address, token_id) with quantity = 1
 * - ERC-1155: one row per (token_address, token_id, owner_address) with quantity = balance
 *
 * Burn strategy: row is deleted when quantity reaches 0 or to_address is zero.
 */
@Entity({ name: 'nft_ownership_current' })
@Index(['ownerAddress'])
@Index(['tokenAddress', 'ownerAddress'])
export class NftOwnershipEntity {
  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @PrimaryColumn({ name: 'token_id', type: 'numeric', precision: 78, scale: 0 })
  tokenId!: string;

  @PrimaryColumn({ name: 'owner_address', type: 'varchar', length: 42 })
  ownerAddress!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '1' })
  quantity!: string;

  @Column({ name: 'last_transfer_block', type: 'bigint' })
  lastTransferBlock!: string;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
