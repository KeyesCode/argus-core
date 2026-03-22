import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';

@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);

  constructor(
    @InjectRepository(SyncCheckpointEntity)
    private readonly checkpointRepo: Repository<SyncCheckpointEntity>,
  ) {}

  async getCheckpoint(workerName: string): Promise<SyncCheckpointEntity | null> {
    return this.checkpointRepo.findOne({ where: { workerName } });
  }

  async getAllCheckpoints(): Promise<SyncCheckpointEntity[]> {
    return this.checkpointRepo.find();
  }

  async updateCheckpoint(
    workerName: string,
    lastSyncedBlock: number,
  ): Promise<void> {
    await this.checkpointRepo.upsert(
      {
        workerName,
        lastSyncedBlock: String(lastSyncedBlock),
        updatedAt: new Date(),
      },
      ['workerName'],
    );
  }
}
