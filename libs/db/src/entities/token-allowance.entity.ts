import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Current allowance state per (token, owner, spender).
 * Updated on each Approval event — the latest value wins.
 * Zero-value allowances are kept (they represent explicit revocations).
 */
@Entity({ name: 'token_allowances_current' })
@Index(['ownerAddress'])
@Index(['spenderAddress'])
@Index(['tokenAddress', 'ownerAddress'])
export class TokenAllowanceEntity {
  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @PrimaryColumn({ name: 'owner_address', type: 'varchar', length: 42 })
  ownerAddress!: string;

  @PrimaryColumn({ name: 'spender_address', type: 'varchar', length: 42 })
  spenderAddress!: string;

  @Column({ name: 'value_raw', type: 'numeric', precision: 78, scale: 0 })
  valueRaw!: string;

  @Column({ name: 'last_approval_block', type: 'bigint' })
  lastApprovalBlock!: string;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
