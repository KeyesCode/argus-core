import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';

@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,
  ) {}

  async listTokens(take: number) {
    return this.tokenRepo.find({ take });
  }

  async getToken(address: string) {
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

  async getTokenTransfers(address: string, take: number, skip: number) {
    const normalized = address.toLowerCase();

    const [transfers, total] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take,
      skip,
    });

    return { transfers, total, limit: take, offset: skip };
  }
}
