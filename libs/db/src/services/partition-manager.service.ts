import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const PARTITION_SIZE = 1_000_000;

const PARTITIONED_TABLES = [
  'transactions',
  'transaction_receipts',
  'logs',
  'token_transfers',
];

@Injectable()
export class PartitionManagerService {
  private readonly logger = new Logger(PartitionManagerService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Ensures partitions exist for the given block number.
   * Creates the partition containing that block, plus the next one ahead.
   * Safe to call repeatedly — uses IF NOT EXISTS.
   */
  async ensurePartitionsForBlock(blockNumber: number): Promise<void> {
    const currentStart = Math.floor(blockNumber / PARTITION_SIZE) * PARTITION_SIZE;
    const nextStart = currentStart + PARTITION_SIZE;

    await this.createPartitionsForRange(currentStart);
    await this.createPartitionsForRange(nextStart);
  }

  /**
   * Creates partitions for a specific range start across all partitioned tables.
   */
  private async createPartitionsForRange(rangeStart: number): Promise<void> {
    const rangeEnd = rangeStart + PARTITION_SIZE;
    const suffix = `${Math.floor(rangeStart / 1_000_000)}m_${Math.floor(rangeEnd / 1_000_000)}m`;

    for (const table of PARTITIONED_TABLES) {
      const partitionName = `${table}_${suffix}`;

      try {
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS "${partitionName}"
          PARTITION OF "${table}"
          FOR VALUES FROM (${rangeStart}) TO (${rangeEnd})
        `);
      } catch (error) {
        // Expected failures: already exists, overlap, or table isn't partitioned (test env)
        const msg = (error as Error).message;
        if (
          !msg.includes('already exists') &&
          !msg.includes('overlap') &&
          !msg.includes('is not partitioned')
        ) {
          this.logger.error(
            `Failed to create partition ${partitionName}: ${msg}`,
          );
        }
      }
    }
  }

  /**
   * Lists all existing partitions for a given table.
   */
  async listPartitions(tableName: string): Promise<string[]> {
    const result = await this.dataSource.query(`
      SELECT inhrelid::regclass::text AS partition_name
      FROM pg_inherits
      WHERE inhparent = $1::regclass
      ORDER BY inhrelid::regclass::text
    `, [tableName]);

    return result.map((r: any) => r.partition_name);
  }
}
