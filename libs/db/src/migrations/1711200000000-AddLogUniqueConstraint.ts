import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogUniqueConstraint1711200000000 implements MigrationInterface {
  name = 'AddLogUniqueConstraint1711200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove the non-unique composite index on logs
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_logs_block_logindex"`);

    // Add unique constraint on (transaction_hash, log_index) — the canonical log identity
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_logs_tx_logindex" ON "logs" ("transaction_hash", "log_index")`,
    );

    // Add index on transaction_receipts.contract_address for contract creation lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_receipts_contract_address" ON "transaction_receipts" ("contract_address") WHERE "contract_address" IS NOT NULL`,
    );

    // Add reorg_events table for audit trail
    await queryRunner.query(`
      CREATE TABLE "reorg_events" (
        "id" SERIAL NOT NULL,
        "detected_at" timestamptz NOT NULL DEFAULT NOW(),
        "reorg_block" bigint NOT NULL,
        "depth" integer NOT NULL,
        "old_hash" varchar(66) NOT NULL,
        "new_hash" varchar(66) NOT NULL,
        "common_ancestor_block" bigint NOT NULL,
        CONSTRAINT "PK_reorg_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reorg_events_detected_at" ON "reorg_events" ("detected_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reorg_events"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_receipts_contract_address"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_logs_tx_logindex"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_logs_block_logindex" ON "logs" ("block_number", "log_index")`,
    );
  }
}
