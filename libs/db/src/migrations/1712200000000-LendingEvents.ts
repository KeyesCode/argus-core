import { MigrationInterface, QueryRunner } from 'typeorm';

export class LendingEvents1712200000000 implements MigrationInterface {
  name = 'LendingEvents1712200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lending_events" (
        "id" SERIAL NOT NULL,
        "protocol_name" varchar(50) NOT NULL,
        "event_type" varchar(20) NOT NULL,
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "log_index" integer NOT NULL,
        "user_address" varchar(42) NOT NULL,
        "asset_address" varchar(42) NOT NULL,
        "amount" numeric(78,0) NOT NULL,
        "on_behalf_of" varchar(42),
        "rate_mode" integer,
        "borrow_rate" numeric(78,0),
        "collateral_asset" varchar(42),
        "debt_to_cover" numeric(78,0),
        "liquidated_collateral" numeric(78,0),
        "liquidator_address" varchar(42),
        CONSTRAINT "PK_lending_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_lending_tx_log" ON "lending_events" ("transaction_hash", "log_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_lending_protocol_block" ON "lending_events" ("protocol_name", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_lending_user_block" ON "lending_events" ("user_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_lending_asset_block" ON "lending_events" ("asset_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_lending_type_block" ON "lending_events" ("event_type", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_lending_block" ON "lending_events" ("block_number")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lending_events"`);
  }
}
