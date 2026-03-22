import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { PaginatedResponse } from '../common/pagination';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,
  ) {}

  async getOverview(address: string, take: number) {
    const normalized = address.toLowerCase();

    const [transactions, tokenTransfers, txCount] = await Promise.all([
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
      this.txRepo.count({
        where: [{ fromAddress: normalized }, { toAddress: normalized }],
      }),
    ]);

    return {
      address: normalized,
      transactionCount: txCount,
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
