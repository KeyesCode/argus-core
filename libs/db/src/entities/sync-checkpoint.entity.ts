import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sync_checkpoints' })
export class SyncCheckpointEntity {
  @PrimaryColumn({ name: 'worker_name', type: 'varchar', length: 100 })
  workerName!: string;

  @Column({ name: 'last_synced_block', type: 'bigint', default: '0' })
  lastSyncedBlock!: string;

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  updatedAt!: Date;
}
