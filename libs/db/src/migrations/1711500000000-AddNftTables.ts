import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNftTables1711500000000 implements MigrationInterface {
  name = 'AddNftTables1711500000000';

  private readonly partitionSize = 1_000_000;
  private readonly maxBlock = 25_000_000;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── nft_transfers (partitioned by block_number) ──
    await queryRunner.query(`
      CREATE TABLE "nft_transfers" (
        "id" bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "log_index" integer NOT NULL,
        "token_address" varchar(42) NOT NULL,
        "token_type" varchar(10) NOT NULL,
        "from_address" varchar(42) NOT NULL,
        "to_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "quantity" numeric(78,0) NOT NULL DEFAULT 1,
        "operator" varchar(42)
      ) PARTITION BY RANGE (block_number)
    `);

    // Create partitions
    for (let start = 0; start < this.maxBlock; start += this.partitionSize) {
      const end = start + this.partitionSize;
      const suffix = `${Math.floor(start / 1_000_000)}m_${Math.floor(end / 1_000_000)}m`;
      await queryRunner.query(
        `CREATE TABLE "nft_transfers_${suffix}" PARTITION OF "nft_transfers" FOR VALUES FROM (${start}) TO (${end})`,
      );
    }

    // Indexes on nft_transfers
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_nft_transfers_tx_log" ON "nft_transfers" ("transaction_hash", "log_index", "block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_token" ON "nft_transfers" ("token_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_from" ON "nft_transfers" ("from_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_to" ON "nft_transfers" ("to_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_block" ON "nft_transfers" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_token_id" ON "nft_transfers" ("token_address", "token_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_token_block_desc" ON "nft_transfers" ("token_address", "block_number" DESC, "log_index" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_from_block_desc" ON "nft_transfers" ("from_address", "block_number" DESC, "log_index" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_transfers_to_block_desc" ON "nft_transfers" ("to_address", "block_number" DESC, "log_index" DESC)`);

    // ── nft_ownership_current (NOT partitioned — current state table) ──
    await queryRunner.query(`
      CREATE TABLE "nft_ownership_current" (
        "token_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "owner_address" varchar(42) NOT NULL,
        "quantity" numeric(78,0) NOT NULL DEFAULT 1,
        "last_transfer_block" bigint NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_nft_ownership" PRIMARY KEY ("token_address", "token_id", "owner_address")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_nft_ownership_owner" ON "nft_ownership_current" ("owner_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_ownership_token_owner" ON "nft_ownership_current" ("token_address", "owner_address")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "nft_ownership_current"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nft_transfers" CASCADE`);
  }
}
