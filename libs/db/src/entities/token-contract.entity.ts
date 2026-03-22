import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'token_contracts' })
export class TokenContractEntity {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  address!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  symbol!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'integer', nullable: true })
  decimals!: number | null;

  @Column({
    name: 'total_supply',
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  totalSupply!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'ERC20' })
  standard!: string;
}
