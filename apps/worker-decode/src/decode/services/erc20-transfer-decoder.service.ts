import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { ERC20_TRANSFER_TOPIC } from '@app/abi';
import { topicToAddress, MetricsService } from '@app/common';
import { TokenMetadataService } from './token-metadata.service';

@Injectable()
export class Erc20TransferDecoderService {
  private readonly logger = new Logger(Erc20TransferDecoderService.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    private readonly metrics: MetricsService,

    private readonly tokenMetadata: TokenMetadataService,
  ) {}

  async decodeBlock(blockNumber: number): Promise<number> {
    const logs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: ERC20_TRANSFER_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    const inserts: Partial<TokenTransferEntity>[] = [];

    for (const log of logs) {
      // ERC-20 Transfer has exactly 3 topics (topic0 + 2 indexed params)
      // and the value in data. ERC-721 has 4 topics — skip those here.
      if (!log.topic1 || !log.topic2 || log.topic3) continue;

      const fromAddress = topicToAddress(log.topic1);
      const toAddress = topicToAddress(log.topic2);

      let amountRaw: string;
      try {
        amountRaw = BigInt(log.data).toString();
      } catch {
        this.logger.warn(
          `Invalid data in log ${log.transactionHash}:${log.logIndex}`,
        );
        continue;
      }

      inserts.push({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        tokenAddress: log.address,
        fromAddress,
        toAddress,
        amountRaw,
      });
    }

    if (inserts.length > 0) {
      await this.transferRepo
        .createQueryBuilder()
        .insert()
        .into(TokenTransferEntity)
        .values(inserts)
        .orIgnore()
        .execute();
    }

    // Auto-discover token metadata for new token addresses
    if (inserts.length > 0) {
      const tokenAddresses = [...new Set(inserts.map((t) => t.tokenAddress!))];
      this.tokenMetadata.ensureBatch(tokenAddresses).catch((err) => {
        this.logger.warn(`Token metadata batch error: ${(err as Error).message}`);
      });
    }

    this.metrics.increment('decode.blocks_processed');
    this.metrics.increment('decode.erc20_transfers', inserts.length);
    this.metrics.recordRate('decode.transfers', inserts.length);

    this.logger.debug(
      `Block ${blockNumber}: decoded ${inserts.length} ERC-20 transfers`,
    );

    return inserts.length;
  }
}
