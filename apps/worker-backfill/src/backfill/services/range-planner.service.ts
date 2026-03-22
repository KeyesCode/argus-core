import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChainProvider, CHAIN_PROVIDER } from '@app/chain-provider';
import { BackfillJobService } from './backfill-job.service';

@Injectable()
export class RangePlannerService {
  private readonly logger = new Logger(RangePlannerService.name);

  constructor(
    @Inject(CHAIN_PROVIDER)
    private readonly chainProvider: ChainProvider,

    private readonly jobService: BackfillJobService,
  ) {}

  async createRecentBackfill(
    blockCount: number,
    batchSize?: number,
  ): Promise<void> {
    const latest = await this.chainProvider.getLatestBlockNumber();
    const fromBlock = Math.max(0, latest - blockCount);

    await this.jobService.createJob(fromBlock, latest, batchSize);
    this.logger.log(
      `Created recent backfill: ${fromBlock} -> ${latest} (${blockCount} blocks)`,
    );
  }

  async createRangeBackfill(
    fromBlock: number,
    toBlock: number,
    batchSize?: number,
  ): Promise<void> {
    await this.jobService.createJob(fromBlock, toBlock, batchSize);
    this.logger.log(
      `Created range backfill: ${fromBlock} -> ${toBlock}`,
    );
  }
}
