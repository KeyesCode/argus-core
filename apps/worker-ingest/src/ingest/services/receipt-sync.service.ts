import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChainProvider, CHAIN_PROVIDER } from '@app/chain-provider';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { normalizeAddress, normalizeHash } from '@app/common';
import { withRetry } from '@app/common/utils/retry';

@Injectable()
export class ReceiptSyncService {
  private readonly logger = new Logger(ReceiptSyncService.name);

  constructor(
    @Inject(CHAIN_PROVIDER)
    private readonly chainProvider: ChainProvider,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TransactionReceiptEntity)
    private readonly receiptRepo: Repository<TransactionReceiptEntity>,

    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,
  ) {}

  async syncReceiptsForBlock(blockNumber: number): Promise<number> {
    const txs = await this.txRepo.find({
      where: { blockNumber: String(blockNumber) },
      order: { transactionIndex: 'ASC' },
    });

    let processed = 0;

    for (const tx of txs) {
      const existing = await this.receiptRepo.findOne({
        where: { transactionHash: tx.hash },
      });

      if (existing) continue;

      const receipt = await withRetry(
        () => this.chainProvider.getTransactionReceipt(tx.hash),
      );
      if (!receipt) continue;

      await this.receiptRepo.save({
        transactionHash: normalizeHash(receipt.transactionHash),
        blockNumber: String(receipt.blockNumber),
        fromAddress: normalizeAddress(receipt.from),
        toAddress: receipt.to ? normalizeAddress(receipt.to) : null,
        contractAddress: receipt.contractAddress
          ? normalizeAddress(receipt.contractAddress)
          : null,
        gasUsed: receipt.gasUsed,
        cumulativeGasUsed: receipt.cumulativeGasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice ?? null,
        status: receipt.status,
      });

      if (receipt.logs.length > 0) {
        await this.logRepo
          .createQueryBuilder()
          .insert()
          .into(LogEntity)
          .values(
            receipt.logs.map((log) => ({
              blockNumber: String(log.blockNumber),
              transactionHash: normalizeHash(log.transactionHash),
              transactionIndex: log.transactionIndex,
              logIndex: log.logIndex,
              address: normalizeAddress(log.address),
              topic0: log.topics[0]?.toLowerCase() ?? null,
              topic1: log.topics[1]?.toLowerCase() ?? null,
              topic2: log.topics[2]?.toLowerCase() ?? null,
              topic3: log.topics[3]?.toLowerCase() ?? null,
              data: log.data,
              removed: log.removed,
            })),
          )
          .orIgnore()
          .execute();
      }

      processed++;
    }

    if (processed > 0) {
      this.logger.log(
        `Block ${blockNumber}: synced ${processed} receipts`,
      );
    }

    return processed;
  }
}
