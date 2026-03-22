import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AddressNftHoldingEntity } from '../entities/address-nft-holding.entity';
import { NftContractStatsEntity } from '../entities/nft-contract-stats.entity';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface NftTransfer {
  tokenAddress: string;
  tokenType: string;
  fromAddress: string;
  toAddress: string;
  tokenId: string;
  quantity: string;
  blockNumber: string;
}

@Injectable()
export class NftReadModelService {
  private readonly logger = new Logger(NftReadModelService.name);

  constructor(
    @InjectRepository(AddressNftHoldingEntity)
    private readonly holdingRepo: Repository<AddressNftHoldingEntity>,

    @InjectRepository(NftContractStatsEntity)
    private readonly statsRepo: Repository<NftContractStatsEntity>,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Update holdings for a single NFT transfer.
   */
  async updateHolding(transfer: NftTransfer): Promise<void> {
    const qty = BigInt(transfer.quantity);

    // Remove from sender
    if (transfer.fromAddress !== ZERO_ADDRESS) {
      const existing = await this.holdingRepo.findOne({
        where: {
          address: transfer.fromAddress,
          tokenAddress: transfer.tokenAddress,
          tokenId: transfer.tokenId,
        },
      });

      if (existing) {
        const newQty = BigInt(existing.quantity) - qty;
        if (newQty <= 0n) {
          await this.holdingRepo.delete({
            address: transfer.fromAddress,
            tokenAddress: transfer.tokenAddress,
            tokenId: transfer.tokenId,
          });
        } else {
          await this.holdingRepo.update(
            {
              address: transfer.fromAddress,
              tokenAddress: transfer.tokenAddress,
              tokenId: transfer.tokenId,
            },
            {
              quantity: newQty.toString(),
              lastTransferBlock: transfer.blockNumber,
              updatedAt: new Date(),
            },
          );
        }
      }
    }

    // Add to receiver
    if (transfer.toAddress !== ZERO_ADDRESS) {
      const existing = await this.holdingRepo.findOne({
        where: {
          address: transfer.toAddress,
          tokenAddress: transfer.tokenAddress,
          tokenId: transfer.tokenId,
        },
      });

      const newQty = existing ? BigInt(existing.quantity) + qty : qty;
      await this.holdingRepo.upsert(
        {
          address: transfer.toAddress,
          tokenAddress: transfer.tokenAddress,
          tokenId: transfer.tokenId,
          tokenType: transfer.tokenType,
          quantity: newQty.toString(),
          lastTransferBlock: transfer.blockNumber,
          updatedAt: new Date(),
        },
        ['address', 'tokenAddress', 'tokenId'],
      );
    }
  }

  /**
   * Increment contract stats for a batch of transfers.
   */
  async updateStatsForTransfers(transfers: NftTransfer[]): Promise<void> {
    // Group by token address
    const byContract = new Map<string, NftTransfer[]>();
    for (const t of transfers) {
      const list = byContract.get(t.tokenAddress) || [];
      list.push(t);
      byContract.set(t.tokenAddress, list);
    }

    for (const [tokenAddress, contractTransfers] of byContract) {
      const tokenType = contractTransfers[0].tokenType;
      const transferCount = contractTransfers.length;
      const lastBlock = contractTransfers.reduce(
        (max, t) => (BigInt(t.blockNumber) > BigInt(max) ? t.blockNumber : max),
        '0',
      );

      await this.dataSource.query(`
        INSERT INTO "nft_contract_stats" ("token_address", "token_type", "total_transfers", "last_activity_block", "updated_at")
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT ("token_address") DO UPDATE SET
          "total_transfers" = "nft_contract_stats"."total_transfers" + $3,
          "last_activity_block" = GREATEST("nft_contract_stats"."last_activity_block", $4),
          "updated_at" = NOW()
      `, [tokenAddress, tokenType, transferCount, lastBlock]);
    }
  }

  /**
   * Recompute holder/token counts for a contract from current state tables.
   * More expensive but accurate — call after backfill or periodically.
   */
  async recomputeContractCounts(tokenAddress: string): Promise<void> {
    // Count unique holders from holdings table
    const [{ count: holders }] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT address) as count FROM "address_nft_holdings"
      WHERE "token_address" = $1
    `, [tokenAddress]);

    const [{ count: tokens }] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT "token_id") as count FROM "address_nft_holdings"
      WHERE "token_address" = $1
    `, [tokenAddress]);

    await this.statsRepo.update(
      { tokenAddress },
      {
        uniqueHolders: Number(holders),
        totalTokensSeen: Number(tokens),
        updatedAt: new Date(),
      },
    );
  }

  /**
   * Rollback holdings for blocks >= rollbackFrom.
   */
  async rollbackHoldings(rollbackFrom: number): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM "address_nft_holdings" WHERE "last_transfer_block" >= $1`,
      [String(rollbackFrom)],
    );
  }
}
