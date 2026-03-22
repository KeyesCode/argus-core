import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'contract_standards' })
export class ContractStandardEntity {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  address!: string;

  @Column({ type: 'varchar', length: 10 })
  standard!: string;

  @Column({ name: 'detection_method', type: 'varchar', length: 20 })
  detectionMethod!: string; // 'erc165' | 'heuristic' | 'manual'

  @Column({ name: 'supports_erc165', type: 'boolean', nullable: true })
  supportsErc165!: boolean | null;

  @Column({ name: 'supports_erc721', type: 'boolean', nullable: true })
  supportsErc721!: boolean | null;

  @Column({ name: 'supports_erc1155', type: 'boolean', nullable: true })
  supportsErc1155!: boolean | null;

  @Column({ name: 'last_checked_block', type: 'bigint', nullable: true })
  lastCheckedBlock!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
