import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockEntity, TransactionEntity, TokenContractEntity]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
