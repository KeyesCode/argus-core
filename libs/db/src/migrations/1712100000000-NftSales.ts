import { MigrationInterface, QueryRunner } from 'typeorm';

export class NftSales1712100000000 implements MigrationInterface {
  name = 'NftSales1712100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "nft_sales" (
        "id" SERIAL NOT NULL,
        "protocol_name" varchar(50) NOT NULL,
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "log_index" integer NOT NULL,
        "order_hash" varchar(66),
        "collection_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "token_standard" varchar(10) NOT NULL,
        "quantity" numeric(78,0) NOT NULL DEFAULT 1,
        "seller_address" varchar(42) NOT NULL,
        "buyer_address" varchar(42) NOT NULL,
        "payment_token" varchar(42) NOT NULL,
        "total_price" numeric(78,0) NOT NULL,
        CONSTRAINT "PK_nft_sales" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_nft_sales_tx_log" ON "nft_sales" ("transaction_hash", "log_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_sales_collection_block" ON "nft_sales" ("collection_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_sales_seller_block" ON "nft_sales" ("seller_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_sales_buyer_block" ON "nft_sales" ("buyer_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_sales_block" ON "nft_sales" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_sales_protocol" ON "nft_sales" ("protocol_name")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "nft_sales"`);
  }
}
