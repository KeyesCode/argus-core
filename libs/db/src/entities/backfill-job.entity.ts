import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum BackfillJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ name: 'backfill_jobs' })
export class BackfillJobEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 50, default: BackfillJobStatus.PENDING })
  status!: string;

  @Column({ name: 'from_block', type: 'bigint' })
  fromBlock!: string;

  @Column({ name: 'to_block', type: 'bigint' })
  toBlock!: string;

  @Column({ name: 'current_block', type: 'bigint', default: '0' })
  currentBlock!: string;

  @Column({ name: 'batch_size', type: 'integer', default: 250 })
  batchSize!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  updatedAt!: Date;
}
