import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { AddressSummaryEntity } from '@app/db/entities/address-summary.entity';
import { PaginatedResponse } from '../common/pagination';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    @InjectRepository(AddressSummaryEntity)
    private readonly summaryRepo: Repository<AddressSummaryEntity>,
  ) {}

  async getOverview(address: string, take: number) {
    const normalized = address.toLowerCase();

    // Try summary table first (O(1) lookup vs full count scan)
    const [summary, transactions, tokenTransfers] = await Promise.all([
      this.summaryRepo.findOne({ where: { address: normalized } }),
      this.txRepo.find({
        where: [{ fromAddress: normalized }, { toAddress: normalized }],
        order: { blockNumber: 'DESC', transactionIndex: 'DESC' },
        take,
      }),
      this.transferRepo.find({
        where: [{ fromAddress: normalized }, { toAddress: normalized }],
        order: { blockNumber: 'DESC', logIndex: 'DESC' },
        take,
      }),
    ]);

    // Fall back to count query only if summary doesn't exist yet
    const txCount = summary?.transactionCount
      ?? await this.txRepo.count({
        where: [{ fromAddress: normalized }, { toAddress: normalized }],
      });

    return {
      address: normalized,
      transactionCount: txCount,
      transferCount: summary?.transferCount ?? 0,
      firstSeenBlock: summary?.firstSeenBlock ?? null,
      lastSeenBlock: summary?.lastSeenBlock ?? null,
      recentTransactions: transactions,
      recentTokenTransfers: tokenTransfers,
    };
  }

  async getTransactions(
    address: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<TransactionEntity>> {
    const normalized = address.toLowerCase();

    const [items, total] = await this.txRepo.findAndCount({
      where: [{ fromAddress: normalized }, { toAddress: normalized }],
      order: { blockNumber: 'DESC', transactionIndex: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { items, total, limit, offset };
  }

  async getTokenTransfers(
    address: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<TokenTransferEntity>> {
    const normalized = address.toLowerCase();

    const [items, total] = await this.transferRepo.findAndCount({
      where: [{ fromAddress: normalized }, { toAddress: normalized }],
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { items, total, limit, offset };
  }
}
