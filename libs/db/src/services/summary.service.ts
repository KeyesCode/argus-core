import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AddressSummaryEntity } from '../entities/address-summary.entity';
import { TokenStatsEntity } from '../entities/token-stats.entity';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(AddressSummaryEntity)
    private readonly addressSummaryRepo: Repository<AddressSummaryEntity>,

    @InjectRepository(TokenStatsEntity)
    private readonly tokenStatsRepo: Repository<TokenStatsEntity>,
  ) {}

  /**
   * Update address summaries for all addresses that appear in a block range.
   * Runs efficient aggregate queries instead of per-address updates.
   */
  async updateAddressSummariesForRange(
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    // Upsert address summaries from transactions in the range
    await this.dataSource.query(`
      INSERT INTO address_summaries (address, transaction_count, first_seen_block, last_seen_block, updated_at)
      SELECT
        addr,
        count(*)::int as tx_count,
        min(block_number)::bigint as first_seen,
        max(block_number)::bigint as last_seen,
        NOW()
      FROM (
        SELECT from_address as addr, block_number FROM transactions
        WHERE block_number >= $1 AND block_number <= $2
        UNION ALL
        SELECT to_address as addr, block_number FROM transactions
        WHERE block_number >= $1 AND block_number <= $2 AND to_address IS NOT NULL
      ) addresses
      GROUP BY addr
      ON CONFLICT (address) DO UPDATE SET
        transaction_count = address_summaries.transaction_count + EXCLUDED.transaction_count,
        first_seen_block = LEAST(address_summaries.first_seen_block, EXCLUDED.first_seen_block),
        last_seen_block = GREATEST(address_summaries.last_seen_block, EXCLUDED.last_seen_block),
        updated_at = NOW()
    `, [String(fromBlock), String(toBlock)]);

    // Update transfer counts from token_transfers in the range
    await this.dataSource.query(`
      INSERT INTO address_summaries (address, transfer_count, first_seen_block, last_seen_block, updated_at)
      SELECT
        addr,
        count(*)::int as xfer_count,
        min(block_number)::bigint as first_seen,
        max(block_number)::bigint as last_seen,
        NOW()
      FROM (
        SELECT from_address as addr, block_number FROM token_transfers
        WHERE block_number >= $1 AND block_number <= $2
        UNION ALL
        SELECT to_address as addr, block_number FROM token_transfers
        WHERE block_number >= $1 AND block_number <= $2
      ) addresses
      GROUP BY addr
      ON CONFLICT (address) DO UPDATE SET
        transfer_count = address_summaries.transfer_count + EXCLUDED.transfer_count,
        first_seen_block = LEAST(address_summaries.first_seen_block, EXCLUDED.first_seen_block),
        last_seen_block = GREATEST(address_summaries.last_seen_block, EXCLUDED.last_seen_block),
        updated_at = NOW()
    `, [String(fromBlock), String(toBlock)]);
  }

  /**
   * Update token stats for all tokens that have transfers in a block range.
   */
  async updateTokenStatsForRange(
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO token_stats (token_address, transfer_count, last_activity_block, updated_at)
      SELECT
        token_address,
        count(*)::int as xfer_count,
        max(block_number)::bigint as last_block,
        NOW()
      FROM token_transfers
      WHERE block_number >= $1 AND block_number <= $2
      GROUP BY token_address
      ON CONFLICT (token_address) DO UPDATE SET
        transfer_count = token_stats.transfer_count + EXCLUDED.transfer_count,
        last_activity_block = GREATEST(token_stats.last_activity_block, EXCLUDED.last_activity_block),
        updated_at = NOW()
    `, [String(fromBlock), String(toBlock)]);
  }

  async getAddressSummary(address: string): Promise<AddressSummaryEntity | null> {
    return this.addressSummaryRepo.findOne({
      where: { address: address.toLowerCase() },
    });
  }

  async getTokenStats(tokenAddress: string): Promise<TokenStatsEntity | null> {
    return this.tokenStatsRepo.findOne({
      where: { tokenAddress: tokenAddress.toLowerCase() },
    });
  }
}
