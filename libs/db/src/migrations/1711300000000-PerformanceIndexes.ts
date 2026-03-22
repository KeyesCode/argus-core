import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexes1711300000000 implements MigrationInterface {
  name = 'PerformanceIndexes1711300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── transactions: composite indexes for address lookups ──
    // These eliminate the BitmapOr + in-memory sort pattern.
    // The query "WHERE from_address = ? ORDER BY block_number DESC" can now
    // use a single index scan backwards.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_from_block_desc"
      ON "transactions" ("from_address", "block_number" DESC, "transaction_index" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_to_block_desc"
      ON "transactions" ("to_address", "block_number" DESC, "transaction_index" DESC)
    `);

    // ── token_transfers: composite indexes for address + token lookups ──
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_token_transfers_from_block_desc"
      ON "token_transfers" ("from_address", "block_number" DESC, "log_index" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_token_transfers_to_block_desc"
      ON "token_transfers" ("to_address", "block_number" DESC, "log_index" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_token_transfers_token_block_desc"
      ON "token_transfers" ("token_address", "block_number" DESC, "log_index" DESC)
    `);

    // ── logs: composite for block-level decode queries ──
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_logs_block_topic0"
      ON "logs" ("block_number", "topic0")
    `);

    // ── address_summaries: derived read model ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "address_summaries" (
        "address" varchar(42) NOT NULL,
        "transaction_count" integer NOT NULL DEFAULT 0,
        "transfer_count" integer NOT NULL DEFAULT 0,
        "first_seen_block" bigint,
        "last_seen_block" bigint,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_address_summaries" PRIMARY KEY ("address")
      )
    `);

    // ── token_stats: derived read model ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_stats" (
        "token_address" varchar(42) NOT NULL,
        "transfer_count" integer NOT NULL DEFAULT 0,
        "holder_count" integer NOT NULL DEFAULT 0,
        "last_activity_block" bigint,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_token_stats" PRIMARY KEY ("token_address")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_stats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "address_summaries"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_logs_block_topic0"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_token_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_to_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_from_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_to_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_from_block_desc"`);
  }
}
