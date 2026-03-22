import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { NftOwnershipEntity } from '@app/db/entities/nft-ownership.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { PaginatedResponse } from '../common/pagination';

@Injectable()
export class NftsService {
  constructor(
    @InjectRepository(NftTransferEntity)
    private readonly transferRepo: Repository<NftTransferEntity>,

    @InjectRepository(NftOwnershipEntity)
    private readonly ownershipRepo: Repository<NftOwnershipEntity>,

    @InjectRepository(NftTokenMetadataEntity)
    private readonly metadataRepo: Repository<NftTokenMetadataEntity>,
  ) {}

  async getCollectionTransfers(
    tokenAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftTransferEntity>> {
    const normalized = tokenAddress.toLowerCase();
    const [items, total] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getToken(tokenAddress: string, tokenId: string) {
    const normalized = tokenAddress.toLowerCase();

    const metadata = await this.metadataRepo.findOne({
      where: { tokenAddress: normalized, tokenId },
    });

    const owners = await this.ownershipRepo.find({
      where: { tokenAddress: normalized, tokenId },
    });

    const recentTransfers = await this.transferRepo.find({
      where: { tokenAddress: normalized, tokenId },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: 25,
    });

    return { tokenAddress: normalized, tokenId, metadata, owners, recentTransfers };
  }

  async getTokenTransfers(
    tokenAddress: string,
    tokenId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftTransferEntity>> {
    const normalized = tokenAddress.toLowerCase();
    const [items, total] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized, tokenId },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getTokenOwners(
    tokenAddress: string,
    tokenId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftOwnershipEntity>> {
    const normalized = tokenAddress.toLowerCase();
    const [items, total] = await this.ownershipRepo.findAndCount({
      where: { tokenAddress: normalized, tokenId },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getNftsByOwner(
    ownerAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftOwnershipEntity>> {
    const normalized = ownerAddress.toLowerCase();
    const [items, total] = await this.ownershipRepo.findAndCount({
      where: { ownerAddress: normalized },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getNftTransfersByOwner(
    ownerAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftTransferEntity>> {
    const normalized = ownerAddress.toLowerCase();
    const [items, total] = await this.transferRepo.findAndCount({
      where: [
        { fromAddress: normalized },
        { toAddress: normalized },
      ],
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }
}
