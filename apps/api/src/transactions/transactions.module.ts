import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEntity,
      TransactionReceiptEntity,
      LogEntity,
      TokenTransferEntity,
    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
