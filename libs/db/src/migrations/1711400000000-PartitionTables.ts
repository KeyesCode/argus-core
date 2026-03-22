import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts logs, token_transfers, transactions, and transaction_receipts
 * from regular tables to range-partitioned tables on block_number.
 *
 * Partition size: 1,000,000 blocks (~5.5 days of Ethereum mainnet).
 *
 * This migration:
 * 1. Renames existing tables to *_old
 * 2. Creates new partitioned parent tables
 * 3. Creates initial partitions covering blocks 0-25M
 * 4. Copies data from old tables
 * 5. Recreates all indexes
 * 6. Drops old tables
 *
 * NOTE: Partitioned tables in Postgres cannot be the target of a FK reference
 * from another table. The FK from transaction_receipts -> transactions is
 * dropped. The FK from transactions -> blocks stays (blocks is the parent side,
 * which is fine).
 */
export class PartitionTables1711400000000 implements MigrationInterface {
  name = 'PartitionTables1711400000000';

  private readonly partitionSize = 1_000_000;
  private readonly maxBlock = 25_000_000; // pre-create partitions up to 25M

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Step 1: Rename existing tables and drop their indexes ──
    // Postgres does NOT rename indexes when you rename a table,
    // so we must drop them to avoid name collisions with the new tables.

    await queryRunner.query(`ALTER TABLE "transaction_receipts" RENAME TO "transaction_receipts_old"`);
    await queryRunner.query(`ALTER TABLE "transactions" RENAME TO "transactions_old"`);
    await queryRunner.query(`ALTER TABLE "logs" RENAME TO "logs_old"`);
    await queryRunner.query(`ALTER TABLE "token_transfers" RENAME TO "token_transfers_old"`);

    // Drop FK constraints first (they depend on PKs)
    await queryRunner.query(`ALTER TABLE "transaction_receipts_old" DROP CONSTRAINT IF EXISTS "FK_receipts_transaction"`);
    await queryRunner.query(`ALTER TABLE "transactions_old" DROP CONSTRAINT IF EXISTS "FK_transactions_block"`);

    // Drop PK constraints (can't use DROP INDEX for PKs)
    await queryRunner.query(`ALTER TABLE "transactions_old" DROP CONSTRAINT IF EXISTS "PK_transactions"`);
    await queryRunner.query(`ALTER TABLE "transaction_receipts_old" DROP CONSTRAINT IF EXISTS "PK_transaction_receipts"`);
    await queryRunner.query(`ALTER TABLE "logs_old" DROP CONSTRAINT IF EXISTS "PK_logs"`);
    await queryRunner.query(`ALTER TABLE "token_transfers_old" DROP CONSTRAINT IF EXISTS "PK_token_transfers"`);

    // Drop all remaining indexes on old tables
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_block_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_block_txindex"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_from"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_from_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_to_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_receipts_block_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_receipts_contract_address"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_logs_tx_logindex"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_logs_block_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_logs_tx_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_logs_address"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_logs_topic0"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_logs_block_topic0"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_tx_log"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_block"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_token"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_from"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_token_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_from_block_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_token_transfers_to_block_desc"`);

    // ── Step 2: Create partitioned parent tables ──

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "transaction_index" integer NOT NULL,
        "from_address" varchar(42) NOT NULL,
        "to_address" varchar(42),
        "value" numeric(78,0) NOT NULL,
        "input_data" text NOT NULL,
        "nonce" bigint NOT NULL,
        "gas" numeric(78,0) NOT NULL,
        "gas_price" numeric(78,0),
        "max_fee_per_gas" numeric(78,0),
        "max_priority_fee_per_gas" numeric(78,0),
        "type" integer
      ) PARTITION BY RANGE (block_number)
    `);

    await queryRunner.query(`
      CREATE TABLE "transaction_receipts" (
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "from_address" varchar(42) NOT NULL,
        "to_address" varchar(42),
        "contract_address" varchar(42),
        "gas_used" numeric(78,0) NOT NULL,
        "cumulative_gas_used" numeric(78,0) NOT NULL,
        "effective_gas_price" numeric(78,0),
        "status" integer NOT NULL
      ) PARTITION BY RANGE (block_number)
    `);

    await queryRunner.query(`
      CREATE TABLE "logs" (
        "id" bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
        "block_number" bigint NOT NULL,
        "transaction_hash" varchar(66) NOT NULL,
        "transaction_index" integer NOT NULL,
        "log_index" integer NOT NULL,
        "address" varchar(42) NOT NULL,
        "topic0" varchar(66),
        "topic1" varchar(66),
        "topic2" varchar(66),
        "topic3" varchar(66),
        "data" text NOT NULL,
        "removed" boolean NOT NULL DEFAULT false
      ) PARTITION BY RANGE (block_number)
    `);

    await queryRunner.query(`
      CREATE TABLE "token_transfers" (
        "id" bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "log_index" integer NOT NULL,
        "token_address" varchar(42) NOT NULL,
        "from_address" varchar(42) NOT NULL,
        "to_address" varchar(42) NOT NULL,
        "amount_raw" numeric(78,0) NOT NULL
      ) PARTITION BY RANGE (block_number)
    `);

    // ── Step 3: Create partitions from 0 to maxBlock ──
    for (let start = 0; start < this.maxBlock; start += this.partitionSize) {
      const end = start + this.partitionSize;
      const suffix = `${Math.floor(start / 1_000_000)}m_${Math.floor(end / 1_000_000)}m`;

      await queryRunner.query(
        `CREATE TABLE "transactions_${suffix}" PARTITION OF "transactions" FOR VALUES FROM (${start}) TO (${end})`,
      );
      await queryRunner.query(
        `CREATE TABLE "transaction_receipts_${suffix}" PARTITION OF "transaction_receipts" FOR VALUES FROM (${start}) TO (${end})`,
      );
      await queryRunner.query(
        `CREATE TABLE "logs_${suffix}" PARTITION OF "logs" FOR VALUES FROM (${start}) TO (${end})`,
      );
      await queryRunner.query(
        `CREATE TABLE "token_transfers_${suffix}" PARTITION OF "token_transfers" FOR VALUES FROM (${start}) TO (${end})`,
      );
    }

    // ── Step 4: Create indexes on partitioned tables ──
    // Postgres auto-creates matching indexes on each partition.

    // transactions indexes
    await queryRunner.query(`CREATE UNIQUE INDEX "PK_transactions" ON "transactions" ("hash", "block_number")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transactions_block_txindex" ON "transactions" ("block_number", "transaction_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_block_number" ON "transactions" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_from" ON "transactions" ("from_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_to" ON "transactions" ("to_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_from_block_desc" ON "transactions" ("from_address", "block_number" DESC, "transaction_index" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_to_block_desc" ON "transactions" ("to_address", "block_number" DESC, "transaction_index" DESC)`);

    // transaction_receipts indexes
    await queryRunner.query(`CREATE UNIQUE INDEX "PK_transaction_receipts" ON "transaction_receipts" ("transaction_hash", "block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_receipts_block_number" ON "transaction_receipts" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_receipts_contract_address" ON "transaction_receipts" ("contract_address") WHERE "contract_address" IS NOT NULL`);

    // logs indexes
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_logs_tx_logindex" ON "logs" ("transaction_hash", "log_index", "block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_block_number" ON "logs" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_tx_hash" ON "logs" ("transaction_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_address" ON "logs" ("address")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_topic0" ON "logs" ("topic0")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_block_topic0" ON "logs" ("block_number", "topic0")`);

    // token_transfers indexes
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_token_transfers_tx_log" ON "token_transfers" ("transaction_hash", "log_index", "block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_block" ON "token_transfers" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_token" ON "token_transfers" ("token_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_from" ON "token_transfers" ("from_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_to" ON "token_transfers" ("to_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_token_block_desc" ON "token_transfers" ("token_address", "block_number" DESC, "log_index" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_from_block_desc" ON "token_transfers" ("from_address", "block_number" DESC, "log_index" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_to_block_desc" ON "token_transfers" ("to_address", "block_number" DESC, "log_index" DESC)`);

    // ── Step 5: Copy data from old tables ──
    // Use OVERRIDING SYSTEM VALUE for GENERATED ALWAYS AS IDENTITY columns
    await queryRunner.query(`INSERT INTO "transactions" SELECT * FROM "transactions_old"`);
    await queryRunner.query(`INSERT INTO "transaction_receipts" SELECT * FROM "transaction_receipts_old"`);
    await queryRunner.query(`INSERT INTO "logs" OVERRIDING SYSTEM VALUE SELECT * FROM "logs_old"`);
    await queryRunner.query(`INSERT INTO "token_transfers" OVERRIDING SYSTEM VALUE SELECT * FROM "token_transfers_old"`);

    // ── Step 6: Drop old tables ──
    await queryRunner.query(`DROP TABLE "transaction_receipts_old"`);
    await queryRunner.query(`DROP TABLE "transactions_old" CASCADE`);
    await queryRunner.query(`DROP TABLE "logs_old"`);
    await queryRunner.query(`DROP TABLE "token_transfers_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate original non-partitioned tables
    await queryRunner.query(`ALTER TABLE "transactions" RENAME TO "transactions_partitioned"`);
    await queryRunner.query(`ALTER TABLE "transaction_receipts" RENAME TO "transaction_receipts_partitioned"`);
    await queryRunner.query(`ALTER TABLE "logs" RENAME TO "logs_partitioned"`);
    await queryRunner.query(`ALTER TABLE "token_transfers" RENAME TO "token_transfers_partitioned"`);

    // Recreate original tables (from InitialSchema migration)
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "transaction_index" integer NOT NULL,
        "from_address" varchar(42) NOT NULL,
        "to_address" varchar(42),
        "value" numeric(78,0) NOT NULL,
        "input_data" text NOT NULL,
        "nonce" bigint NOT NULL,
        "gas" numeric(78,0) NOT NULL,
        "gas_price" numeric(78,0),
        "max_fee_per_gas" numeric(78,0),
        "max_priority_fee_per_gas" numeric(78,0),
        "type" integer,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("hash"),
        CONSTRAINT "FK_transactions_block" FOREIGN KEY ("block_number")
          REFERENCES "blocks"("number") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transaction_receipts" (
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "from_address" varchar(42) NOT NULL,
        "to_address" varchar(42),
        "contract_address" varchar(42),
        "gas_used" numeric(78,0) NOT NULL,
        "cumulative_gas_used" numeric(78,0) NOT NULL,
        "effective_gas_price" numeric(78,0),
        "status" integer NOT NULL,
        CONSTRAINT "PK_transaction_receipts" PRIMARY KEY ("transaction_hash"),
        CONSTRAINT "FK_receipts_transaction" FOREIGN KEY ("transaction_hash")
          REFERENCES "transactions"("hash") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "logs" (
        "id" SERIAL NOT NULL,
        "block_number" bigint NOT NULL,
        "transaction_hash" varchar(66) NOT NULL,
        "transaction_index" integer NOT NULL,
        "log_index" integer NOT NULL,
        "address" varchar(42) NOT NULL,
        "topic0" varchar(66),
        "topic1" varchar(66),
        "topic2" varchar(66),
        "topic3" varchar(66),
        "data" text NOT NULL,
        "removed" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "token_transfers" (
        "id" SERIAL NOT NULL,
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "log_index" integer NOT NULL,
        "token_address" varchar(42) NOT NULL,
        "from_address" varchar(42) NOT NULL,
        "to_address" varchar(42) NOT NULL,
        "amount_raw" numeric(78,0) NOT NULL,
        CONSTRAINT "PK_token_transfers" PRIMARY KEY ("id")
      )
    `);

    // Copy data back
    await queryRunner.query(`INSERT INTO "transactions" SELECT * FROM "transactions_partitioned"`);
    await queryRunner.query(`INSERT INTO "transaction_receipts" SELECT * FROM "transaction_receipts_partitioned"`);
    await queryRunner.query(`INSERT INTO "logs" (id, block_number, transaction_hash, transaction_index, log_index, address, topic0, topic1, topic2, topic3, data, removed) SELECT * FROM "logs_partitioned"`);
    await queryRunner.query(`INSERT INTO "token_transfers" (id, transaction_hash, block_number, log_index, token_address, from_address, to_address, amount_raw) SELECT * FROM "token_transfers_partitioned"`);

    // Drop partitioned tables
    await queryRunner.query(`DROP TABLE "transactions_partitioned" CASCADE`);
    await queryRunner.query(`DROP TABLE "transaction_receipts_partitioned" CASCADE`);
    await queryRunner.query(`DROP TABLE "logs_partitioned" CASCADE`);
    await queryRunner.query(`DROP TABLE "token_transfers_partitioned" CASCADE`);
  }
}
