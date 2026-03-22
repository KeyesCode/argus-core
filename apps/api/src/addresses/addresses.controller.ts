import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';

@Controller('addresses')
export class AddressesController {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,
  ) {}

  @Get(':address')
  async getAddressOverview(
    @Param('address') address: string,
    @Query('limit') limit?: string,
  ) {
    const normalized = address.toLowerCase();
    const take = Math.min(Number(limit ?? 25), 100);

    const [transactions, tokenTransfers, txCount] = await Promise.all([
      this.txRepo.find({
        where: [
          { fromAddress: normalized },
          { toAddress: normalized },
        ],
        order: { blockNumber: 'DESC', transactionIndex: 'DESC' },
        take,
      }),

      this.transferRepo.find({
        where: [
          { fromAddress: normalized },
          { toAddress: normalized },
        ],
        order: { blockNumber: 'DESC', logIndex: 'DESC' },
        take,
      }),

      this.txRepo.count({
        where: [
          { fromAddress: normalized },
          { toAddress: normalized },
        ],
      }),
    ]);

    return {
      address: normalized,
      transactionCount: txCount,
      recentTransactions: transactions,
      recentTokenTransfers: tokenTransfers,
    };
  }

  @Get(':address/transactions')
  async getAddressTransactions(
    @Param('address') address: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const normalized = address.toLowerCase();
    const take = Math.min(Number(limit ?? 25), 100);
    const skip = Number(offset ?? 0);

    const [transactions, total] = await this.txRepo.findAndCount({
      where: [
        { fromAddress: normalized },
        { toAddress: normalized },
      ],
      order: { blockNumber: 'DESC', transactionIndex: 'DESC' },
      take,
      skip,
    });

    return { transactions, total, limit: take, offset: skip };
  }

  @Get(':address/token-transfers')
  async getAddressTokenTransfers(
    @Param('address') address: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const normalized = address.toLowerCase();
    const take = Math.min(Number(limit ?? 25), 100);
    const skip = Number(offset ?? 0);

    const [transfers, total] = await this.transferRepo.findAndCount({
      where: [
        { fromAddress: normalized },
        { toAddress: normalized },
      ],
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take,
      skip,
    });

    return { transfers, total, limit: take, offset: skip };
  }
}
