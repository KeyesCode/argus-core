import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export type IssueType =
  | 'ERC721_OWNER_MISMATCH'
  | 'ERC721_MISSING_OWNER'
  | 'ERC1155_BALANCE_MISMATCH'
  | 'HOLDING_MISMATCH'
  | 'CONTRACT_STATS_MISMATCH'
  | 'INVALID_ZERO_BALANCE_ROW'
  | 'NEGATIVE_BALANCE'
  | 'ORPHANED_HOLDING';

export interface ValidationIssue {
  type: IssueType;
  tokenAddress: string;
  tokenId?: string;
  ownerAddress?: string;
  expected?: string;
  actual?: string;
  detail?: string;
}

export interface ValidationReport {
  checkedContracts: number;
  checkedTokens: number;
  issuesFound: number;
  issues: ValidationIssue[];
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}

export interface RebuildResult {
  table: string;
  rowsDeleted: number;
  rowsInserted: number;
  durationMs: number;
}

export interface ReconcileReport {
  rebuilds: RebuildResult[];
  validation: ValidationReport;
  totalDurationMs: number;
}

@Injectable()
export class NftReconciliationService {
  private readonly logger = new Logger(NftReconciliationService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ────────────────────────────────────────────────────────────────
  // REBUILD: erc721_ownership from nft_transfers
  // ────────────────────────────────────────────────────────────────
  async rebuildErc721Ownership(tokenAddress?: string): Promise<RebuildResult> {
    const start = Date.now();
    const scope = tokenAddress ? `contract ${tokenAddress}` : 'all';
    this.logger.log(`Rebuilding erc721_ownership for ${scope}`);

    const whereClause = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';

    // Count existing rows before delete
    const [{ count: before }] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "erc721_ownership" ${whereClause}`,
    );

    // Truncate scoped rows
    if (tokenAddress) {
      await this.dataSource.query(
        `DELETE FROM "erc721_ownership" WHERE "token_address" = $1`,
        [tokenAddress],
      );
    } else {
      await this.dataSource.query(`TRUNCATE "erc721_ownership"`);
    }

    // Rebuild: latest non-burn transfer per (token_address, token_id)
    const contractFilter = tokenAddress
      ? `AND nt.token_address = '${tokenAddress}'`
      : '';

    await this.dataSource.query(`
      INSERT INTO "erc721_ownership" ("token_address", "token_id", "owner_address", "last_transfer_block", "updated_at")
      SELECT DISTINCT ON (nt.token_address, nt.token_id)
        nt.token_address,
        nt.token_id,
        nt.to_address,
        nt.block_number,
        NOW()
      FROM nft_transfers nt
      WHERE nt.token_type = 'ERC721'
        AND nt.to_address != $1
        ${contractFilter}
      ORDER BY nt.token_address, nt.token_id, nt.block_number DESC, nt.log_index DESC
    `, [ZERO_ADDRESS]);

    const whereAfter = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';
    const [{ count: inserted }] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "erc721_ownership" ${whereAfter}`,
    );
    this.logger.log(`Rebuilt erc721_ownership: deleted ${before}, inserted ${inserted}`);

    return {
      table: 'erc721_ownership',
      rowsDeleted: Number(before),
      rowsInserted: inserted,
      durationMs: Date.now() - start,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // REBUILD: erc1155_balances from nft_transfers
  // ────────────────────────────────────────────────────────────────
  async rebuildErc1155Balances(tokenAddress?: string): Promise<RebuildResult> {
    const start = Date.now();
    this.logger.log(`Rebuilding erc1155_balances`);

    const whereClause = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';

    const [{ count: before }] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "erc1155_balances" ${whereClause}`,
    );

    if (tokenAddress) {
      await this.dataSource.query(
        `DELETE FROM "erc1155_balances" WHERE "token_address" = $1`,
        [tokenAddress],
      );
    } else {
      await this.dataSource.query(`TRUNCATE "erc1155_balances"`);
    }

    const contractFilter = tokenAddress
      ? `AND token_address = '${tokenAddress}'`
      : '';

    // Compute net balance per (token_address, token_id, owner) from all transfers
    const result = await this.dataSource.query(`
      INSERT INTO "erc1155_balances" ("token_address", "token_id", "owner_address", "balance", "last_transfer_block", "updated_at")
      SELECT
        token_address,
        token_id,
        owner_address,
        net_balance,
        last_block,
        NOW()
      FROM (
        SELECT
          token_address,
          token_id,
          owner_address,
          SUM(delta)::numeric as net_balance,
          MAX(block_number) as last_block
        FROM (
          -- Received tokens (positive delta)
          SELECT token_address, token_id, to_address as owner_address,
                 quantity::numeric as delta, block_number
          FROM nft_transfers
          WHERE token_type = 'ERC1155' AND to_address != $1 ${contractFilter}

          UNION ALL

          -- Sent tokens (negative delta)
          SELECT token_address, token_id, from_address as owner_address,
                 -quantity::numeric as delta, block_number
          FROM nft_transfers
          WHERE token_type = 'ERC1155' AND from_address != $1 ${contractFilter}
        ) deltas
        GROUP BY token_address, token_id, owner_address
        HAVING SUM(delta) > 0
      ) balances
    `, [ZERO_ADDRESS]);

    const whereAfter1155 = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';
    const [{ count: inserted }] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "erc1155_balances" ${whereAfter1155}`,
    );
    this.logger.log(`Rebuilt erc1155_balances: deleted ${before}, inserted ${inserted}`);

    return {
      table: 'erc1155_balances',
      rowsDeleted: Number(before),
      rowsInserted: inserted,
      durationMs: Date.now() - start,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // REBUILD: address_nft_holdings from current-state tables
  // ────────────────────────────────────────────────────────────────
  async rebuildAddressHoldings(tokenAddress?: string): Promise<RebuildResult> {
    const start = Date.now();
    this.logger.log(`Rebuilding address_nft_holdings`);

    const whereClause = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';

    const [{ count: before }] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "address_nft_holdings" ${whereClause}`,
    );

    if (tokenAddress) {
      await this.dataSource.query(
        `DELETE FROM "address_nft_holdings" WHERE "token_address" = $1`,
        [tokenAddress],
      );
    } else {
      await this.dataSource.query(`TRUNCATE "address_nft_holdings"`);
    }

    const contractFilter721 = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';
    const contractFilter1155 = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';

    // Insert from ERC-721 ownership
    await this.dataSource.query(`
      INSERT INTO "address_nft_holdings" ("address", "token_address", "token_id", "token_type", "quantity", "last_transfer_block", "updated_at")
      SELECT "owner_address", "token_address", "token_id", 'ERC721', 1, "last_transfer_block", NOW()
      FROM "erc721_ownership" ${contractFilter721}
      ON CONFLICT ("address", "token_address", "token_id") DO UPDATE SET
        "quantity" = EXCLUDED."quantity",
        "last_transfer_block" = EXCLUDED."last_transfer_block",
        "updated_at" = NOW()
    `);

    // Insert from ERC-1155 balances
    await this.dataSource.query(`
      INSERT INTO "address_nft_holdings" ("address", "token_address", "token_id", "token_type", "quantity", "last_transfer_block", "updated_at")
      SELECT "owner_address", "token_address", "token_id", 'ERC1155', "balance", "last_transfer_block", NOW()
      FROM "erc1155_balances" ${contractFilter1155}
      ON CONFLICT ("address", "token_address", "token_id") DO UPDATE SET
        "quantity" = EXCLUDED."quantity",
        "last_transfer_block" = EXCLUDED."last_transfer_block",
        "updated_at" = NOW()
    `);

    const [{ count: after }] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "address_nft_holdings" ${whereClause}`,
    );

    return {
      table: 'address_nft_holdings',
      rowsDeleted: Number(before),
      rowsInserted: Number(after),
      durationMs: Date.now() - start,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // RECOMPUTE: nft_contract_stats
  // ────────────────────────────────────────────────────────────────
  async recomputeContractStats(tokenAddress?: string): Promise<RebuildResult> {
    const start = Date.now();
    this.logger.log(`Recomputing nft_contract_stats`);

    if (tokenAddress) {
      await this.dataSource.query(
        `DELETE FROM "nft_contract_stats" WHERE "token_address" = $1`,
        [tokenAddress],
      );
    } else {
      await this.dataSource.query(`TRUNCATE "nft_contract_stats"`);
    }

    const contractFilter = tokenAddress
      ? `WHERE nt.token_address = '${tokenAddress}'`
      : '';

    await this.dataSource.query(`
      INSERT INTO "nft_contract_stats" (
        "token_address", "token_type", "total_transfers",
        "unique_holders", "total_tokens_seen", "last_activity_block", "updated_at"
      )
      SELECT
        nt.token_address,
        nt.token_type,
        COUNT(*)::int as total_transfers,
        0 as unique_holders,
        COUNT(DISTINCT nt.token_id)::int as total_tokens_seen,
        MAX(nt.block_number) as last_activity_block,
        NOW()
      FROM nft_transfers nt
      ${contractFilter}
      GROUP BY nt.token_address, nt.token_type
      ON CONFLICT ("token_address") DO UPDATE SET
        "total_transfers" = EXCLUDED."total_transfers",
        "total_tokens_seen" = EXCLUDED."total_tokens_seen",
        "last_activity_block" = EXCLUDED."last_activity_block",
        "updated_at" = NOW()
    `);

    // Compute holder counts from holdings
    const holdingsFilter = tokenAddress
      ? `WHERE "token_address" = '${tokenAddress}'`
      : '';
    const holderCounts: Array<{ token_address: string; holders: string }> =
      await this.dataSource.query(`
        SELECT "token_address", COUNT(DISTINCT "address")::int as holders
        FROM "address_nft_holdings" ${holdingsFilter}
        GROUP BY "token_address"
      `);

    for (const row of holderCounts) {
      await this.dataSource.query(
        `UPDATE "nft_contract_stats" SET "unique_holders" = $1, "updated_at" = NOW() WHERE "token_address" = $2`,
        [Number(row.holders), row.token_address],
      );
    }

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "nft_contract_stats"`,
    );

    return {
      table: 'nft_contract_stats',
      rowsDeleted: 0,
      rowsInserted: Number(count),
      durationMs: Date.now() - start,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // VALIDATE: detect drift in all derived tables
  // ────────────────────────────────────────────────────────────────
  async validate(tokenAddress?: string): Promise<ValidationReport> {
    const startedAt = new Date();
    const issues: ValidationIssue[] = [];

    const contractFilter = tokenAddress
      ? `AND token_address = '${tokenAddress}'`
      : '';
    const contractWhere = tokenAddress
      ? `WHERE token_address = '${tokenAddress}'`
      : '';

    // 1. ERC-721 ownership mismatches
    const ownerMismatches: any[] = await this.dataSource.query(`
      WITH expected AS (
        SELECT DISTINCT ON (token_address, token_id)
          token_address, token_id, to_address as expected_owner, block_number
        FROM nft_transfers
        WHERE token_type = 'ERC721' AND to_address != $1 ${contractFilter}
        ORDER BY token_address, token_id, block_number DESC, log_index DESC
      )
      SELECT e.token_address, e.token_id, e.expected_owner,
             o.owner_address as actual_owner
      FROM expected e
      LEFT JOIN erc721_ownership o
        ON e.token_address = o.token_address AND e.token_id = o.token_id
      WHERE o.owner_address IS NULL OR o.owner_address != e.expected_owner
    `, [ZERO_ADDRESS]);

    for (const row of ownerMismatches) {
      issues.push({
        type: row.actual_owner ? 'ERC721_OWNER_MISMATCH' : 'ERC721_MISSING_OWNER',
        tokenAddress: row.token_address,
        tokenId: row.token_id,
        expected: row.expected_owner,
        actual: row.actual_owner ?? 'MISSING',
      });
    }

    // 2. Invalid zero/negative ERC-1155 balances
    const badBalances: any[] = await this.dataSource.query(`
      SELECT token_address, token_id, owner_address, balance
      FROM erc1155_balances
      WHERE balance::numeric <= 0 ${contractFilter.replace('AND', 'AND')}
    `);

    for (const row of badBalances) {
      issues.push({
        type: BigInt(row.balance) < 0n ? 'NEGATIVE_BALANCE' : 'INVALID_ZERO_BALANCE_ROW',
        tokenAddress: row.token_address,
        tokenId: row.token_id,
        ownerAddress: row.owner_address,
        actual: row.balance,
      });
    }

    // 3. Holdings mismatches vs ERC-721 ownership
    const holdingMismatches: any[] = await this.dataSource.query(`
      SELECT o.token_address, o.token_id, o.owner_address,
             h.address as holding_address, h.quantity as holding_qty
      FROM erc721_ownership o
      LEFT JOIN address_nft_holdings h
        ON h.address = o.owner_address AND h.token_address = o.token_address AND h.token_id = o.token_id
      WHERE h.address IS NULL ${contractFilter.replace('token_address', 'o.token_address')}
    `);

    for (const row of holdingMismatches) {
      issues.push({
        type: 'HOLDING_MISMATCH',
        tokenAddress: row.token_address,
        tokenId: row.token_id,
        ownerAddress: row.owner_address,
        detail: 'ERC-721 ownership exists but no matching holding row',
      });
    }

    // 4. Contract stats mismatches
    const statsMismatches: any[] = await this.dataSource.query(`
      WITH expected AS (
        SELECT token_address, COUNT(*)::int as expected_transfers
        FROM nft_transfers ${contractWhere}
        GROUP BY token_address
      )
      SELECT e.token_address, e.expected_transfers,
             COALESCE(s.total_transfers, 0) as actual_transfers
      FROM expected e
      LEFT JOIN nft_contract_stats s ON e.token_address = s.token_address
      WHERE s.total_transfers IS NULL OR s.total_transfers != e.expected_transfers
    `);

    for (const row of statsMismatches) {
      issues.push({
        type: 'CONTRACT_STATS_MISMATCH',
        tokenAddress: row.token_address,
        expected: String(row.expected_transfers),
        actual: String(row.actual_transfers),
        detail: 'total_transfers mismatch',
      });
    }

    const [{ contracts }] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT token_address)::int as contracts FROM nft_transfers ${contractWhere}`,
    );
    const [{ tokens }] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT (token_address, token_id))::int as tokens FROM nft_transfers ${contractWhere}`,
    );

    const finishedAt = new Date();
    return {
      checkedContracts: Number(contracts),
      checkedTokens: Number(tokens),
      issuesFound: issues.length,
      issues,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  // ────────────────────────────────────────────────────────────────
  // FULL RECONCILE: rebuild all derived layers in correct order
  // ────────────────────────────────────────────────────────────────
  async fullReconcile(
    tokenAddress?: string,
    dryRun = false,
  ): Promise<ReconcileReport> {
    const totalStart = Date.now();
    const rebuilds: RebuildResult[] = [];

    if (!dryRun) {
      this.logger.log('Starting full NFT reconciliation...');

      // 1. Rebuild current-state from source-of-truth
      rebuilds.push(await this.rebuildErc721Ownership(tokenAddress));
      rebuilds.push(await this.rebuildErc1155Balances(tokenAddress));

      // 2. Rebuild read models from current-state
      rebuilds.push(await this.rebuildAddressHoldings(tokenAddress));

      // 3. Recompute stats
      rebuilds.push(await this.recomputeContractStats(tokenAddress));

      this.logger.log('Full reconciliation complete.');
    }

    // 4. Validate
    const validation = await this.validate(tokenAddress);

    return {
      rebuilds,
      validation,
      totalDurationMs: Date.now() - totalStart,
    };
  }
}
