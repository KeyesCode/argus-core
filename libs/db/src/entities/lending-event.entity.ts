import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'lending_events' })
@Index(['transactionHash', 'logIndex'], { unique: true })
@Index(['protocolName', 'blockNumber'])
@Index(['userAddress', 'blockNumber'])
@Index(['assetAddress', 'blockNumber'])
@Index(['eventType', 'blockNumber'])
@Index(['blockNumber'])
export class LendingEventEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'protocol_name', type: 'varchar', length: 50 })
  protocolName!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 20 })
  eventType!: string; // 'DEPOSIT' | 'WITHDRAW' | 'BORROW' | 'REPAY' | 'LIQUIDATION'

  @Column({ name: 'transaction_hash', type: 'varchar', length: 66 })
  transactionHash!: string;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber!: string;

  @Column({ name: 'log_index', type: 'integer' })
  logIndex!: number;

  @Column({ name: 'user_address', type: 'varchar', length: 42 })
  userAddress!: string;

  @Column({ name: 'asset_address', type: 'varchar', length: 42 })
  assetAddress!: string;

  @Column({ name: 'amount', type: 'numeric', precision: 78, scale: 0 })
  amount!: string;

  @Column({ name: 'on_behalf_of', type: 'varchar', length: 42, nullable: true })
  onBehalfOf!: string | null;

  // Borrow-specific
  @Column({ name: 'rate_mode', type: 'integer', nullable: true })
  rateMode!: number | null;

  @Column({ name: 'borrow_rate', type: 'numeric', precision: 78, scale: 0, nullable: true })
  borrowRate!: string | null;

  // Liquidation-specific
  @Column({ name: 'collateral_asset', type: 'varchar', length: 42, nullable: true })
  collateralAsset!: string | null;

  @Column({ name: 'debt_to_cover', type: 'numeric', precision: 78, scale: 0, nullable: true })
  debtToCover!: string | null;

  @Column({ name: 'liquidated_collateral', type: 'numeric', precision: 78, scale: 0, nullable: true })
  liquidatedCollateral!: string | null;

  @Column({ name: 'liquidator_address', type: 'varchar', length: 42, nullable: true })
  liquidatorAddress!: string | null;
}
