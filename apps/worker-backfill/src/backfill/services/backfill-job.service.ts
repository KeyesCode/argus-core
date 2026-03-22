import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackfillJobEntity, BackfillJobStatus } from '@app/db/entities/backfill-job.entity';

@Injectable()
export class BackfillJobService {
  private readonly logger = new Logger(BackfillJobService.name);

  constructor(
    @InjectRepository(BackfillJobEntity)
    private readonly jobRepo: Repository<BackfillJobEntity>,
  ) {}

  async createJob(
    fromBlock: number,
    toBlock: number,
    batchSize?: number,
  ): Promise<BackfillJobEntity> {
    const job = this.jobRepo.create({
      fromBlock: String(fromBlock),
      toBlock: String(toBlock),
      currentBlock: String(fromBlock),
      batchSize: batchSize ?? Number(process.env.BACKFILL_BATCH_SIZE ?? 250),
      status: BackfillJobStatus.PENDING,
    });

    const saved = await this.jobRepo.save(job);
    this.logger.log(
      `Created backfill job #${saved.id}: blocks ${fromBlock} -> ${toBlock}`,
    );
    return saved;
  }

  async getActiveJobs(): Promise<BackfillJobEntity[]> {
    return this.jobRepo.find({
      where: [
        { status: BackfillJobStatus.PENDING },
        { status: BackfillJobStatus.RUNNING },
      ],
      order: { id: 'ASC' },
    });
  }

  async getJob(id: number): Promise<BackfillJobEntity | null> {
    return this.jobRepo.findOne({ where: { id } });
  }

  async getAllJobs(): Promise<BackfillJobEntity[]> {
    return this.jobRepo.find({ order: { id: 'DESC' } });
  }

  async updateProgress(
    id: number,
    currentBlock: number,
  ): Promise<void> {
    await this.jobRepo.update(id, {
      currentBlock: String(currentBlock),
      status: BackfillJobStatus.RUNNING,
      updatedAt: new Date(),
    });
  }

  async markCompleted(id: number): Promise<void> {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.COMPLETED,
      updatedAt: new Date(),
    });
    this.logger.log(`Backfill job #${id} completed`);
  }

  async markFailed(id: number, error: string): Promise<void> {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.FAILED,
      errorMessage: error,
      updatedAt: new Date(),
    });
    this.logger.error(`Backfill job #${id} failed: ${error}`);
  }

  async pauseJob(id: number): Promise<void> {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.PAUSED,
      updatedAt: new Date(),
    });
    this.logger.log(`Backfill job #${id} paused`);
  }

  async resumeJob(id: number): Promise<void> {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.PENDING,
      updatedAt: new Date(),
    });
    this.logger.log(`Backfill job #${id} resumed`);
  }
}
