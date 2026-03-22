import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LogEntity } from '@app/db/entities/log.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { NftOwnershipEntity } from '@app/db/entities/nft-ownership.entity';
import {
  ERC20_TRANSFER_TOPIC,
  ERC1155_TRANSFER_SINGLE_TOPIC,
  ERC1155_TRANSFER_BATCH_TOPIC,
  ERC1155_URI_TOPIC,
} from '@app/abi';
import { AbiCoder } from 'ethers';
import { MetricsService } from '@app/common';
import { ContractStandardDetectorService } from './contract-standard-detector.service';
import { NftMetadataService } from './nft-metadata.service';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

@Injectable()
export class NftTransferDecoderService {
  private readonly logger = new Logger(NftTransferDecoderService.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(NftTransferEntity)
    private readonly nftTransferRepo: Repository<NftTransferEntity>,

    @InjectRepository(NftOwnershipEntity)
    private readonly ownershipRepo: Repository<NftOwnershipEntity>,

    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
    private readonly standardDetector: ContractStandardDetectorService,
    private readonly nftMetadata: NftMetadataService,
  ) {}

  /**
   * Decode ERC-721 Transfer logs for a block.
   * 4-topic Transfer logs where the contract is not confirmed ERC-20.
   */
  async decodeBlock(blockNumber: number): Promise<number> {
    // Find 4-topic Transfer logs (ERC-721 candidates)
    const logs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: ERC20_TRANSFER_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    const inserts: Partial<NftTransferEntity>[] = [];

    for (const log of logs) {
      // ERC-721: 4 topics (topic0, from, to, tokenId)
      if (!log.topic1 || !log.topic2 || !log.topic3) continue;

      // Check if this contract is actually ERC-721 (not a non-standard ERC-20)
      const classification = await this.standardDetector.classifyTransferLog(
        log.address,
        4,
      );
      if (classification !== 'ERC721') continue;

      const fromAddress = `0x${log.topic1.slice(-40)}`.toLowerCase();
      const toAddress = `0x${log.topic2.slice(-40)}`.toLowerCase();

      let tokenId: string;
      try {
        tokenId = BigInt(log.topic3).toString();
      } catch {
        this.logger.warn(
          `Invalid tokenId in log ${log.transactionHash}:${log.logIndex}`,
        );
        continue;
      }

      inserts.push({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        tokenAddress: log.address,
        tokenType: 'ERC721',
        fromAddress,
        toAddress,
        tokenId,
        quantity: '1',
        operator: null,
      });
    }

    // Persist ERC-721 transfers
    if (inserts.length > 0) {
      await this.nftTransferRepo
        .createQueryBuilder()
        .insert()
        .into(NftTransferEntity)
        .values(inserts)
        .orIgnore()
        .execute();

      for (const transfer of inserts) {
        await this.updateErc721Ownership(transfer);
      }
    }

    const erc721Count = inserts.length;

    // ── ERC-1155 TransferSingle ──
    const singleLogs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: ERC1155_TRANSFER_SINGLE_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    for (const log of singleLogs) {
      if (!log.topic1 || !log.topic2 || !log.topic3) continue;
      try {
        const operator = `0x${log.topic1.slice(-40)}`.toLowerCase();
        const fromAddress = `0x${log.topic2.slice(-40)}`.toLowerCase();
        const toAddress = `0x${log.topic3.slice(-40)}`.toLowerCase();
        const decoded = AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'uint256'],
          log.data,
        );
        const tokenId = decoded[0].toString();
        const quantity = decoded[1].toString();

        inserts.push({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          tokenAddress: log.address,
          tokenType: 'ERC1155',
          fromAddress,
          toAddress,
          tokenId,
          quantity,
          operator,
        });
      } catch {
        this.logger.warn(
          `Failed to decode ERC-1155 TransferSingle ${log.transactionHash}:${log.logIndex}`,
        );
      }
    }

    // ── ERC-1155 TransferBatch ──
    const batchLogs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: ERC1155_TRANSFER_BATCH_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    for (const log of batchLogs) {
      if (!log.topic1 || !log.topic2 || !log.topic3) continue;
      try {
        const operator = `0x${log.topic1.slice(-40)}`.toLowerCase();
        const fromAddress = `0x${log.topic2.slice(-40)}`.toLowerCase();
        const toAddress = `0x${log.topic3.slice(-40)}`.toLowerCase();
        const decoded = AbiCoder.defaultAbiCoder().decode(
          ['uint256[]', 'uint256[]'],
          log.data,
        );
        const ids: bigint[] = decoded[0];
        const values: bigint[] = decoded[1];

        for (let i = 0; i < ids.length; i++) {
          inserts.push({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            // Use a synthetic log_index for batch items to maintain uniqueness
            logIndex: log.logIndex * 1000 + i,
            tokenAddress: log.address,
            tokenType: 'ERC1155',
            fromAddress,
            toAddress,
            tokenId: ids[i].toString(),
            quantity: values[i].toString(),
            operator,
          });
        }
      } catch {
        this.logger.warn(
          `Failed to decode ERC-1155 TransferBatch ${log.transactionHash}:${log.logIndex}`,
        );
      }
    }

    // ── Persist all NFT transfers (ERC-721 + ERC-1155) ──
    if (inserts.length > erc721Count) {
      // We already inserted ERC-721 above, now insert the ERC-1155 ones
      const erc1155Inserts = inserts.slice(erc721Count);
      if (erc1155Inserts.length > 0) {
        await this.nftTransferRepo
          .createQueryBuilder()
          .insert()
          .into(NftTransferEntity)
          .values(erc1155Inserts)
          .orIgnore()
          .execute();

        // Update ERC-1155 balances
        for (const transfer of erc1155Inserts) {
          await this.updateErc1155Balance(transfer);
        }
      }
    }

    // Fire-and-forget metadata discovery for new tokens
    if (inserts.length > 0) {
      const tokenItems = inserts.map((t) => ({
        tokenAddress: t.tokenAddress!,
        tokenId: t.tokenId!,
        tokenType: t.tokenType!,
      }));
      this.nftMetadata.ensureBatch(tokenItems).catch((err) => {
        this.logger.warn(`NFT metadata batch error: ${(err as Error).message}`);
      });
    }

    this.metrics.increment('decode.nft_transfers', inserts.length);

    if (inserts.length > 0) {
      this.logger.debug(
        `Block ${blockNumber}: decoded ${inserts.length} NFT transfers (${erc721Count} ERC-721, ${inserts.length - erc721Count} ERC-1155)`,
      );
    }

    return inserts.length;
  }

  /**
   * Update ERC-721 ownership. Each tokenId has exactly one owner.
   * - Mint (from = 0x0): insert new ownership row
   * - Burn (to = 0x0): delete ownership row
   * - Transfer: delete old owner row, insert new owner row
   */
  private async updateErc721Ownership(
    transfer: Partial<NftTransferEntity>,
  ): Promise<void> {
    const { tokenAddress, tokenId, fromAddress, toAddress, blockNumber } = transfer;

    // Remove from previous owner (if not a mint)
    if (fromAddress !== ZERO_ADDRESS) {
      await this.ownershipRepo.delete({
        tokenAddress: tokenAddress!,
        tokenId: tokenId!,
        ownerAddress: fromAddress!,
      });
    }

    // Add to new owner (if not a burn)
    if (toAddress !== ZERO_ADDRESS) {
      await this.ownershipRepo.upsert(
        {
          tokenAddress: tokenAddress!,
          tokenId: tokenId!,
          ownerAddress: toAddress!,
          quantity: '1',
          lastTransferBlock: blockNumber!,
          updatedAt: new Date(),
        },
        ['tokenAddress', 'tokenId', 'ownerAddress'],
      );
    }
  }

  /**
   * Update ERC-1155 balance. Multiple owners can hold the same tokenId.
   * - Subtract quantity from sender (delete row if balance reaches 0)
   * - Add quantity to receiver
   */
  private async updateErc1155Balance(
    transfer: Partial<NftTransferEntity>,
  ): Promise<void> {
    const { tokenAddress, tokenId, fromAddress, toAddress, quantity, blockNumber } = transfer;
    const qty = BigInt(quantity!);

    // Subtract from sender (if not a mint)
    if (fromAddress !== ZERO_ADDRESS) {
      const existing = await this.ownershipRepo.findOne({
        where: {
          tokenAddress: tokenAddress!,
          tokenId: tokenId!,
          ownerAddress: fromAddress!,
        },
      });

      if (existing) {
        const newBalance = BigInt(existing.quantity) - qty;
        if (newBalance <= 0n) {
          await this.ownershipRepo.delete({
            tokenAddress: tokenAddress!,
            tokenId: tokenId!,
            ownerAddress: fromAddress!,
          });
        } else {
          await this.ownershipRepo.update(
            {
              tokenAddress: tokenAddress!,
              tokenId: tokenId!,
              ownerAddress: fromAddress!,
            },
            {
              quantity: newBalance.toString(),
              lastTransferBlock: blockNumber!,
              updatedAt: new Date(),
            },
          );
        }
      }
    }

    // Add to receiver (if not a burn)
    if (toAddress !== ZERO_ADDRESS) {
      const existing = await this.ownershipRepo.findOne({
        where: {
          tokenAddress: tokenAddress!,
          tokenId: tokenId!,
          ownerAddress: toAddress!,
        },
      });

      if (existing) {
        const newBalance = BigInt(existing.quantity) + qty;
        await this.ownershipRepo.update(
          {
            tokenAddress: tokenAddress!,
            tokenId: tokenId!,
            ownerAddress: toAddress!,
          },
          {
            quantity: newBalance.toString(),
            lastTransferBlock: blockNumber!,
            updatedAt: new Date(),
          },
        );
      } else {
        await this.ownershipRepo.upsert(
          {
            tokenAddress: tokenAddress!,
            tokenId: tokenId!,
            ownerAddress: toAddress!,
            quantity: qty.toString(),
            lastTransferBlock: blockNumber!,
            updatedAt: new Date(),
          },
          ['tokenAddress', 'tokenId', 'ownerAddress'],
        );
      }
    }
  }

  /**
   * Recompute ownership for tokens affected by a reorg rollback.
   * Called after nft_transfers rows have been deleted for the rolled-back blocks.
   */
  async recomputeOwnershipForAffectedTokens(
    rollbackFrom: number,
  ): Promise<void> {
    // Find all (token_address, token_id) pairs that had transfers in rolled-back blocks
    // These are now deleted, but we need to know which tokens were affected
    // We can find them from the ownership table — any ownership with
    // last_transfer_block >= rollbackFrom needs recomputation
    const affected = await this.ownershipRepo.find({
      where: {},
      select: ['tokenAddress', 'tokenId'],
    });

    // For efficiency on small reorgs, query ownership rows that point to
    // rolled-back blocks
    await this.dataSource.query(`
      DELETE FROM "nft_ownership_current"
      WHERE "last_transfer_block" >= $1
    `, [String(rollbackFrom)]);

    // Recompute from remaining nft_transfers
    await this.dataSource.query(`
      INSERT INTO "nft_ownership_current" ("token_address", "token_id", "owner_address", "quantity", "last_transfer_block", "updated_at")
      SELECT DISTINCT ON (nt.token_address, nt.token_id)
        nt.token_address,
        nt.token_id,
        nt.to_address as owner_address,
        1 as quantity,
        nt.block_number as last_transfer_block,
        NOW() as updated_at
      FROM nft_transfers nt
      WHERE nt.token_type = 'ERC721'
        AND nt.to_address != $1
        AND (nt.token_address, nt.token_id) IN (
          SELECT token_address, token_id FROM nft_transfers
          WHERE block_number < $2
          GROUP BY token_address, token_id
        )
      ORDER BY nt.token_address, nt.token_id, nt.block_number DESC, nt.log_index DESC
      ON CONFLICT ("token_address", "token_id", "owner_address") DO UPDATE SET
        quantity = EXCLUDED.quantity,
        last_transfer_block = EXCLUDED.last_transfer_block,
        updated_at = NOW()
    `, [ZERO_ADDRESS, String(rollbackFrom)]);
  }
}
