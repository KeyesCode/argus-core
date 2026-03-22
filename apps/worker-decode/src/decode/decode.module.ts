import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { Erc20TransferDecoderService } from './services/erc20-transfer-decoder.service';
import { TokenMetadataService } from './services/token-metadata.service';
import { DecodeProcessor } from './processors/decode-processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LogEntity,
      TokenTransferEntity,
      TokenContractEntity,
    ]),
  ],
  providers: [
    Erc20TransferDecoderService,
    TokenMetadataService,
    DecodeProcessor,
  ],
  exports: [Erc20TransferDecoderService, TokenMetadataService],
})
export class DecodeModule {}
