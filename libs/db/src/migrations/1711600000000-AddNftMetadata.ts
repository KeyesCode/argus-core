import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNftMetadata1711600000000 implements MigrationInterface {
  name = 'AddNftMetadata1711600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "nft_token_metadata" (
        "token_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "token_uri" text,
        "metadata_json" jsonb,
        "name" varchar(255),
        "description" text,
        "image_url" text,
        "fetch_status" varchar(20) NOT NULL DEFAULT 'pending',
        "fetch_attempts" integer NOT NULL DEFAULT 0,
        "last_fetch_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_nft_token_metadata" PRIMARY KEY ("token_address", "token_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_nft_metadata_status" ON "nft_token_metadata" ("fetch_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "nft_token_metadata"`);
  }
}
