import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { AddressNftHoldingEntity } from '@app/db/entities/address-nft-holding.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { NftContractStatsEntity } from '@app/db/entities/nft-contract-stats.entity';
import {
  PaginatedResponse,
  CursorPaginatedResponse,
  parseCursor,
  buildCursor,
} from '../common/pagination';

@Injectable()
export class NftsService {
  constructor(
    @InjectRepository(NftTransferEntity)
    private readonly transferRepo: Repository<NftTransferEntity>,

    @InjectRepository(Erc721OwnershipEntity)
    private readonly erc721Repo: Repository<Erc721OwnershipEntity>,

    @InjectRepository(Erc1155BalanceEntity)
    private readonly erc1155Repo: Repository<Erc1155BalanceEntity>,

    @InjectRepository(NftTokenMetadataEntity)
    private readonly metadataRepo: Repository<NftTokenMetadataEntity>,

    @InjectRepository(AddressNftHoldingEntity)
    private readonly holdingRepo: Repository<AddressNftHoldingEntity>,

    @InjectRepository(NftContractStatsEntity)
    private readonly statsRepo: Repository<NftContractStatsEntity>,
  ) {}

  async getCollectionTransfers(
    tokenAddress: string,
    limit: number,
    cursor?: string,
  ): Promise<CursorPaginatedResponse<NftTransferEntity>> {
    const normalized = tokenAddress.toLowerCase();
    const parsed = parseCursor(cursor);

    const qb = this.transferRepo.createQueryBuilder('t')
      .where('t.token_address = :addr', { addr: normalized })
      .orderBy('t.block_number', 'DESC')
      .addOrderBy('t.log_index', 'DESC')
      .take(limit + 1);

    if (parsed) {
      qb.andWhere(
        '(t.block_number < :bn OR (t.block_number = :bn AND t.log_index < :li))',
        { bn: parsed.blockNumber, li: parsed.logIndex },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? buildCursor(items[items.length - 1].blockNumber, items[items.length - 1].logIndex)
      : null;

    return { items, nextCursor, limit };
  }

  async getToken(tokenAddress: string, tokenId: string) {
    const normalized = tokenAddress.toLowerCase();

    const metadata = await this.metadataRepo.findOne({
      where: { tokenAddress: normalized, tokenId },
    });

    const erc721Owners = await this.erc721Repo.find({
      where: { tokenAddress: normalized, tokenId },
    });

    const erc1155Owners = await this.erc1155Repo.find({
      where: { tokenAddress: normalized, tokenId },
    });

    const owners = [...erc721Owners, ...erc1155Owners];

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
    cursor?: string,
  ): Promise<CursorPaginatedResponse<NftTransferEntity>> {
    const normalized = tokenAddress.toLowerCase();
    const parsed = parseCursor(cursor);

    const qb = this.transferRepo.createQueryBuilder('t')
      .where('t.token_address = :addr AND t.token_id = :tid', { addr: normalized, tid: tokenId })
      .orderBy('t.block_number', 'DESC')
      .addOrderBy('t.log_index', 'DESC')
      .take(limit + 1);

    if (parsed) {
      qb.andWhere(
        '(t.block_number < :bn OR (t.block_number = :bn AND t.log_index < :li))',
        { bn: parsed.blockNumber, li: parsed.logIndex },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? buildCursor(items[items.length - 1].blockNumber, items[items.length - 1].logIndex)
      : null;

    return { items, nextCursor, limit };
  }

  async getTokenOwners(
    tokenAddress: string,
    tokenId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<Erc721OwnershipEntity | Erc1155BalanceEntity>> {
    const normalized = tokenAddress.toLowerCase();

    // Query both tables
    const [erc721Items, erc721Total] = await this.erc721Repo.findAndCount({
      where: { tokenAddress: normalized, tokenId },
      take: limit,
      skip: offset,
    });

    const [erc1155Items, erc1155Total] = await this.erc1155Repo.findAndCount({
      where: { tokenAddress: normalized, tokenId },
      take: limit,
      skip: offset,
    });

    const items = [...erc721Items, ...erc1155Items].slice(0, limit);
    const total = erc721Total + erc1155Total;

    return { items, total, limit, offset };
  }

  async getNftsByOwner(
    ownerAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<AddressNftHoldingEntity>> {
    const normalized = ownerAddress.toLowerCase();
    const [items, total] = await this.holdingRepo.findAndCount({
      where: { address: normalized },
      order: { lastTransferBlock: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getNftTransfersByOwner(
    ownerAddress: string,
    limit: number,
    cursor?: string,
  ): Promise<CursorPaginatedResponse<NftTransferEntity>> {
    const normalized = ownerAddress.toLowerCase();
    const parsed = parseCursor(cursor);

    const qb = this.transferRepo.createQueryBuilder('t')
      .where('(t.from_address = :addr OR t.to_address = :addr)', { addr: normalized })
      .orderBy('t.block_number', 'DESC')
      .addOrderBy('t.log_index', 'DESC')
      .take(limit + 1);

    if (parsed) {
      qb.andWhere(
        '(t.block_number < :bn OR (t.block_number = :bn AND t.log_index < :li))',
        { bn: parsed.blockNumber, li: parsed.logIndex },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? buildCursor(items[items.length - 1].blockNumber, items[items.length - 1].logIndex)
      : null;

    return { items, nextCursor, limit };
  }

  async getCollectionStats(tokenAddress: string): Promise<NftContractStatsEntity | null> {
    return this.statsRepo.findOne({
      where: { tokenAddress: tokenAddress.toLowerCase() },
    });
  }
}
