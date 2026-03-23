import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { ReceiptSyncService } from '../services/receipt-sync.service';
import { QUEUE_NAMES } from '@app/queue';

@Processor(QUEUE_NAMES.DECODE_LOGS)
export class BlockProcessor {
  private readonly logger = new Logger(BlockProcessor.name);

  constructor(
    private readonly receiptSyncService: ReceiptSyncService,

    @InjectQueue(QUEUE_NAMES.DECODE_LOGS)
    private readonly decodeQueue: Queue,
  ) {}

  @Process('process-block')
  async handleProcessBlock(job: Job<{ blockNumber: number }>): Promise<void> {
    const { blockNumber } = job.data;
    this.logger.debug(`Processing receipts for block ${blockNumber}`);
    await this.receiptSyncService.syncReceiptsForBlock(blockNumber);

    // After receipts + logs are saved, enqueue decode job for the decode worker
    await this.decodeQueue.add('decode-block', { blockNumber }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
