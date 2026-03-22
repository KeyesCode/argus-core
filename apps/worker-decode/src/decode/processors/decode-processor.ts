import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_NAMES } from '@app/queue';
import { Erc20TransferDecoderService } from '../services/erc20-transfer-decoder.service';

@Processor(QUEUE_NAMES.DECODE_LOGS)
export class DecodeProcessor {
  private readonly logger = new Logger(DecodeProcessor.name);

  constructor(
    private readonly erc20Decoder: Erc20TransferDecoderService,
  ) {}

  @Process('decode-block')
  async handleDecodeBlock(job: Job<{ blockNumber: number }>): Promise<void> {
    const { blockNumber } = job.data;
    this.logger.debug(`Decoding logs for block ${blockNumber}`);
    await this.erc20Decoder.decodeBlock(blockNumber);
  }
}
