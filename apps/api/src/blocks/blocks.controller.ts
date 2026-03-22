import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';

@Controller('blocks')
export class BlocksController {
  constructor(
    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,
  ) {}

  @Get('latest')
  async getLatestBlocks(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit ?? 25), 100);
    return this.blockRepo.find({
      order: { number: 'DESC' },
      take,
    });
  }

  @Get(':numberOrHash')
  async getBlock(@Param('numberOrHash') numberOrHash: string) {
    const isHash = numberOrHash.startsWith('0x');

    const block = isHash
      ? await this.blockRepo.findOne({
          where: { hash: numberOrHash.toLowerCase() },
        })
      : await this.blockRepo.findOne({
          where: { number: numberOrHash },
        });

    if (!block) {
      throw new NotFoundException(`Block ${numberOrHash} not found`);
    }

    const transactions = await this.txRepo.find({
      where: { blockNumber: block.number },
      order: { transactionIndex: 'ASC' },
    });

    return { ...block, transactions };
  }
}
