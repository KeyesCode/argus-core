import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { NftOwnershipEntity } from '@app/db/entities/nft-ownership.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { NftsController } from './nfts.controller';
import { NftsService } from './nfts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NftTransferEntity,
      NftOwnershipEntity,
      NftTokenMetadataEntity,
    ]),
  ],
  controllers: [NftsController],
  providers: [NftsService],
  exports: [NftsService],
})
export class NftsModule {}
