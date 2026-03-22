import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbModule } from '@app/db';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { BackfillJobEntity } from '@app/db/entities/backfill-job.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';
import { HealthController } from './health/health.controller';
import { BlocksController } from './blocks/blocks.controller';
import { TransactionsController } from './transactions/transactions.controller';
import { AddressesController } from './addresses/addresses.controller';
import { TokensController } from './tokens/tokens.controller';
import { SearchController } from './search/search.controller';
import { AdminController } from './admin/admin.controller';

@Module({
  imports: [
    DbModule,
    TypeOrmModule.forFeature([
      BlockEntity,
      TransactionEntity,
      TransactionReceiptEntity,
      LogEntity,
      TokenContractEntity,
      TokenTransferEntity,
      SyncCheckpointEntity,
      BackfillJobEntity,
      ReorgEventEntity,
    ]),
  ],
  controllers: [
    HealthController,
    BlocksController,
    TransactionsController,
    AddressesController,
    TokensController,
    SearchController,
    AdminController,
  ],
})
export class AppModule {}
