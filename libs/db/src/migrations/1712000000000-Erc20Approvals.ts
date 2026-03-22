import { MigrationInterface, QueryRunner } from 'typeorm';

export class Erc20Approvals1712000000000 implements MigrationInterface {
  name = 'Erc20Approvals1712000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "token_approvals" (
        "id" SERIAL NOT NULL,
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "log_index" integer NOT NULL,
        "token_address" varchar(42) NOT NULL,
        "owner_address" varchar(42) NOT NULL,
        "spender_address" varchar(42) NOT NULL,
        "value_raw" numeric(78,0) NOT NULL,
        CONSTRAINT "PK_token_approvals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_approvals_tx_log" ON "token_approvals" ("transaction_hash", "log_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_owner_block" ON "token_approvals" ("owner_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_spender_block" ON "token_approvals" ("spender_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_token_block" ON "token_approvals" ("token_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_owner_token" ON "token_approvals" ("owner_address", "token_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_block" ON "token_approvals" ("block_number")`);

    await queryRunner.query(`
      CREATE TABLE "token_allowances_current" (
        "token_address" varchar(42) NOT NULL,
        "owner_address" varchar(42) NOT NULL,
        "spender_address" varchar(42) NOT NULL,
        "value_raw" numeric(78,0) NOT NULL,
        "last_approval_block" bigint NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_allowances" PRIMARY KEY ("token_address", "owner_address", "spender_address")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_allowances_owner" ON "token_allowances_current" ("owner_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_allowances_spender" ON "token_allowances_current" ("spender_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_allowances_token_owner" ON "token_allowances_current" ("token_address", "owner_address")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_allowances_current"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_approvals"`);
  }
}
