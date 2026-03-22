import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  imports: [TypeOrmModule.forFeature([TokenContractEntity, TokenTransferEntity])],
  controllers: [TokensController],
  providers: [TokensService],
})
export class TokensModule {}
