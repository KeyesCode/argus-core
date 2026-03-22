import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';
import { BlockSyncService } from './services/block-sync.service';
import { ReceiptSyncService } from './services/receipt-sync.service';
import { CheckpointService } from './services/checkpoint.service';
import { ReorgDetectionService } from './services/reorg-detection.service';
import { BlockProcessor } from './processors/block-processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlockEntity,
      TransactionEntity,
      TransactionReceiptEntity,
      LogEntity,
      TokenTransferEntity,
      SyncCheckpointEntity,
      ReorgEventEntity,
    ]),
  ],
  providers: [
    BlockSyncService,
    ReceiptSyncService,
    CheckpointService,
    ReorgDetectionService,
    BlockProcessor,
  ],
  exports: [BlockSyncService, ReceiptSyncService, CheckpointService, ReorgDetectionService],
})
export class IngestModule {}
