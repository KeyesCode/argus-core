import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reorg_events' })
export class ReorgEventEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'NOW()' })
  detectedAt!: Date;

  @Column({ name: 'reorg_block', type: 'bigint' })
  reorgBlock!: string;

  @Column({ type: 'integer' })
  depth!: number;

  @Column({ name: 'old_hash', type: 'varchar', length: 66 })
  oldHash!: string;

  @Column({ name: 'new_hash', type: 'varchar', length: 66 })
  newHash!: string;

  @Column({ name: 'common_ancestor_block', type: 'bigint' })
  commonAncestorBlock!: string;
}
