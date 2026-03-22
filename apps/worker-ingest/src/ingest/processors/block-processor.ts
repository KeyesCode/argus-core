import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ReceiptSyncService } from '../services/receipt-sync.service';
import { QUEUE_NAMES } from '@app/queue';

@Processor(QUEUE_NAMES.DECODE_LOGS)
export class BlockProcessor {
  private readonly logger = new Logger(BlockProcessor.name);

  constructor(private readonly receiptSyncService: ReceiptSyncService) {}

  @Process('process-block')
  async handleProcessBlock(job: Job<{ blockNumber: number }>): Promise<void> {
    const { blockNumber } = job.data;
    this.logger.debug(`Processing receipts for block ${blockNumber}`);
    await this.receiptSyncService.syncReceiptsForBlock(blockNumber);
  }
}
