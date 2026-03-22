import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TransactionReceiptEntity)
    private readonly receiptRepo: Repository<TransactionReceiptEntity>,

    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,
  ) {}

  async getTransaction(hash: string) {
    const normalized = hash.toLowerCase();

    const transaction = await this.txRepo.findOne({
      where: { hash: normalized },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${hash} not found`);
    }

    const [receipt, logs, tokenTransfers] = await Promise.all([
      this.receiptRepo.findOne({
        where: { transactionHash: normalized },
      }),
      this.logRepo.find({
        where: { transactionHash: normalized },
        order: { logIndex: 'ASC' },
      }),
      this.transferRepo.find({
        where: { transactionHash: normalized },
        order: { logIndex: 'ASC' },
      }),
    ]);

    return { transaction, receipt, logs, tokenTransfers };
  }
}
