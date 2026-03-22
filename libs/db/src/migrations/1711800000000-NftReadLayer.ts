import { MigrationInterface, QueryRunner } from 'typeorm';

export class NftReadLayer1711800000000 implements MigrationInterface {
  name = 'NftReadLayer1711800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── address_nft_holdings ──
    await queryRunner.query(`
      CREATE TABLE "address_nft_holdings" (
        "address" varchar(42) NOT NULL,
        "token_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "token_type" varchar(10) NOT NULL,
        "quantity" numeric(78,0) NOT NULL DEFAULT 1,
        "last_transfer_block" bigint NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_address_nft_holdings" PRIMARY KEY ("address", "token_address", "token_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_holdings_addr_block" ON "address_nft_holdings" ("address", "last_transfer_block" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_holdings_token" ON "address_nft_holdings" ("token_address", "token_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_holdings_addr_type" ON "address_nft_holdings" ("address", "token_type")`);

    // ── nft_contract_stats ──
    await queryRunner.query(`
      CREATE TABLE "nft_contract_stats" (
        "token_address" varchar(42) NOT NULL,
        "token_type" varchar(10) NOT NULL,
        "total_transfers" integer NOT NULL DEFAULT 0,
        "unique_holders" integer NOT NULL DEFAULT 0,
        "total_tokens_seen" integer NOT NULL DEFAULT 0,
        "last_activity_block" bigint,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_nft_contract_stats" PRIMARY KEY ("token_address")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_nft_stats_activity" ON "nft_contract_stats" ("last_activity_block" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_stats_holders" ON "nft_contract_stats" ("unique_holders" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_stats_transfers" ON "nft_contract_stats" ("total_transfers" DESC)`);

    // ── contract_standards ──
    await queryRunner.query(`
      CREATE TABLE "contract_standards" (
        "address" varchar(42) NOT NULL,
        "standard" varchar(10) NOT NULL,
        "detection_method" varchar(20) NOT NULL,
        "supports_erc165" boolean,
        "supports_erc721" boolean,
        "supports_erc1155" boolean,
        "last_checked_block" bigint,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_contract_standards" PRIMARY KEY ("address")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_standards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nft_contract_stats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "address_nft_holdings"`);
  }
}
