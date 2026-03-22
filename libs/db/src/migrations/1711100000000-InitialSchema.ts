import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711100000000 implements MigrationInterface {
  name = 'InitialSchema1711100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // blocks
    await queryRunner.query(`
      CREATE TABLE "blocks" (
        "number" bigint NOT NULL,
        "hash" varchar(66) NOT NULL,
        "parent_hash" varchar(66) NOT NULL,
        "timestamp" timestamptz NOT NULL,
        "gas_limit" numeric(78,0) NOT NULL,
        "gas_used" numeric(78,0) NOT NULL,
        "base_fee_per_gas" numeric(78,0),
        "miner" varchar(42),
        CONSTRAINT "PK_blocks" PRIMARY KEY ("number")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_blocks_hash" ON "blocks" ("hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_blocks_timestamp" ON "blocks" ("timestamp")`);

    // transactions
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
    await queryRunner.query(`CREATE INDEX "IDX_transactions_block_number" ON "transactions" ("block_number")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transactions_block_txindex" ON "transactions" ("block_number", "transaction_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_from" ON "transactions" ("from_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_to" ON "transactions" ("to_address")`);

    // transaction_receipts
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
    await queryRunner.query(`CREATE INDEX "IDX_receipts_block_number" ON "transaction_receipts" ("block_number")`);

    // logs
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
    await queryRunner.query(`CREATE INDEX "IDX_logs_block_number" ON "logs" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_block_logindex" ON "logs" ("block_number", "log_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_tx_hash" ON "logs" ("transaction_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_address" ON "logs" ("address")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_topic0" ON "logs" ("topic0")`);

    // token_contracts
    await queryRunner.query(`
      CREATE TABLE "token_contracts" (
        "address" varchar(42) NOT NULL,
        "symbol" varchar(64),
        "name" varchar(255),
        "decimals" integer,
        "total_supply" numeric(78,0),
        "standard" varchar(32) NOT NULL DEFAULT 'ERC20',
        CONSTRAINT "PK_token_contracts" PRIMARY KEY ("address")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_token_contracts_symbol" ON "token_contracts" ("symbol")`);

    // token_transfers
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
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_token_transfers_tx_log" ON "token_transfers" ("transaction_hash", "log_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_token" ON "token_transfers" ("token_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_from" ON "token_transfers" ("from_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_to" ON "token_transfers" ("to_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_transfers_block" ON "token_transfers" ("block_number")`);

    // sync_checkpoints
    await queryRunner.query(`
      CREATE TABLE "sync_checkpoints" (
        "worker_name" varchar(100) NOT NULL,
        "last_synced_block" bigint NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_sync_checkpoints" PRIMARY KEY ("worker_name")
      )
    `);

    // backfill_jobs
    await queryRunner.query(`
      CREATE TABLE "backfill_jobs" (
        "id" SERIAL NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "from_block" bigint NOT NULL,
        "to_block" bigint NOT NULL,
        "current_block" bigint NOT NULL DEFAULT 0,
        "batch_size" integer NOT NULL DEFAULT 250,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_backfill_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_backfill_jobs_status" ON "backfill_jobs" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "backfill_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_checkpoints"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_transfers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_contracts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blocks"`);
  }
}
