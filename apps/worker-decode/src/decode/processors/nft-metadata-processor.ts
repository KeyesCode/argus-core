import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_NAMES } from '@app/queue';
import { NftMetadataService } from '../services/nft-metadata.service';

export interface NftMetadataJob {
  tokenAddress: string;
  tokenId: string;
  tokenType: string;
}

@Processor(QUEUE_NAMES.NFT_METADATA)
export class NftMetadataProcessor {
  private readonly logger = new Logger(NftMetadataProcessor.name);

  constructor(private readonly metadataService: NftMetadataService) {}

  @Process('fetch-metadata')
  async handleFetchMetadata(job: Job<NftMetadataJob>): Promise<void> {
    const { tokenAddress, tokenId, tokenType } = job.data;
    this.logger.debug(`Fetching metadata for ${tokenAddress}:${tokenId}`);
    await this.metadataService.ensureMetadata(tokenAddress, tokenId, tokenType);
  }
}
