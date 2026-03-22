import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';

@Controller('tokens')
export class TokensController {
  constructor(
    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,
  ) {}

  @Get()
  async listTokens(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit ?? 25), 100);
    return this.tokenRepo.find({ take });
  }

  @Get(':address')
  async getToken(@Param('address') address: string) {
    const normalized = address.toLowerCase();

    const token = await this.tokenRepo.findOne({
      where: { address: normalized },
    });

    if (!token) {
      throw new NotFoundException(`Token ${address} not found`);
    }

    const recentTransfers = await this.transferRepo.find({
      where: { tokenAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: 25,
    });

    return { token, recentTransfers };
  }

  @Get(':address/transfers')
  async getTokenTransfers(
    @Param('address') address: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const normalized = address.toLowerCase();
    const take = Math.min(Number(limit ?? 25), 100);
    const skip = Number(offset ?? 0);

    const [transfers, total] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take,
      skip,
    });

    return { transfers, total, limit: take, offset: skip };
  }
}
