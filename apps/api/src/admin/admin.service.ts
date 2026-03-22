import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { BackfillJobEntity, BackfillJobStatus } from '@app/db/entities/backfill-job.entity';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(SyncCheckpointEntity)
    private readonly checkpointRepo: Repository<SyncCheckpointEntity>,

    @InjectRepository(BackfillJobEntity)
    private readonly jobRepo: Repository<BackfillJobEntity>,

    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    @InjectRepository(ReorgEventEntity)
    private readonly reorgRepo: Repository<ReorgEventEntity>,
  ) {}

  async getStatus() {
    const [checkpoints, activeJobs, blockCount, txCount, logCount, transferCount] =
      await Promise.all([
        this.checkpointRepo.find(),
        this.jobRepo.find({
          where: [
            { status: BackfillJobStatus.PENDING },
            { status: BackfillJobStatus.RUNNING },
          ],
        }),
        this.blockRepo.count(),
        this.txRepo.count(),
        this.logRepo.count(),
        this.transferRepo.count(),
      ]);

    const [latestBlock] = await this.blockRepo.find({
      order: { number: 'DESC' },
      take: 1,
    });

    const [earliestBlock] = await this.blockRepo.find({
      order: { number: 'ASC' },
      take: 1,
    });

    const reorgCount = await this.reorgRepo.count();

    return {
      indexedHead: latestBlock?.number ?? null,
      earliestBlock: earliestBlock?.number ?? null,
      counts: {
        blocks: blockCount,
        transactions: txCount,
        logs: logCount,
        tokenTransfers: transferCount,
      },
      checkpoints: checkpoints.map((cp) => ({
        worker: cp.workerName,
        lastBlock: cp.lastSyncedBlock,
        updatedAt: cp.updatedAt,
      })),
      backfill: {
        activeJobs: activeJobs.length,
        jobs: activeJobs.map((j) => ({
          id: j.id,
          status: j.status,
          range: `${j.fromBlock} -> ${j.toBlock}`,
          current: j.currentBlock,
          batchSize: j.batchSize,
        })),
      },
      reorgCount,
    };
  }

  async getMetrics() {
    const [blockCount, txCount, logCount, transferCount] = await Promise.all([
      this.blockRepo.count(),
      this.txRepo.count(),
      this.logRepo.count(),
      this.transferRepo.count(),
    ]);

    const [latestBlock] = await this.blockRepo.find({
      order: { number: 'DESC' },
      take: 1,
    });

    const checkpoints = await this.checkpointRepo.find();

    const [activeJobs, failedJobs, reorgCount] = await Promise.all([
      this.jobRepo.count({
        where: [
          { status: BackfillJobStatus.PENDING },
          { status: BackfillJobStatus.RUNNING },
        ],
      }),
      this.jobRepo.count({
        where: { status: BackfillJobStatus.FAILED },
      }),
      this.reorgRepo.count(),
    ]);

    return {
      db: {
        blocks: blockCount,
        transactions: txCount,
        logs: logCount,
        token_transfers: transferCount,
      },
      sync: {
        indexed_head: latestBlock?.number ?? null,
        checkpoints: Object.fromEntries(
          checkpoints.map((cp) => [cp.workerName, Number(cp.lastSyncedBlock)]),
        ),
      },
      backfill: {
        active_jobs: activeJobs,
        failed_jobs: failedJobs,
      },
      reorgs: {
        total: reorgCount,
      },
    };
  }

  async getCheckpoints() {
    return this.checkpointRepo.find();
  }

  async getBackfillJobs() {
    return this.jobRepo.find({ order: { id: 'DESC' } });
  }

  async createBackfillJob(fromBlock: number, toBlock: number, batchSize?: number) {
    const job = this.jobRepo.create({
      fromBlock: String(fromBlock),
      toBlock: String(toBlock),
      currentBlock: String(fromBlock),
      batchSize: batchSize ?? 250,
      status: BackfillJobStatus.PENDING,
    });
    return this.jobRepo.save(job);
  }

  async pauseJob(id: number) {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.PAUSED,
      updatedAt: new Date(),
    });
    return { message: `Job ${id} paused` };
  }

  async resumeJob(id: number) {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.PENDING,
      updatedAt: new Date(),
    });
    return { message: `Job ${id} resumed` };
  }

  async getReorgEvents(take: number) {
    return this.reorgRepo.find({
      order: { detectedAt: 'DESC' },
      take,
    });
  }
}
