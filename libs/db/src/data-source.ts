import { DataSource } from 'typeorm';
import { BlockEntity } from './entities/block.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionReceiptEntity } from './entities/transaction-receipt.entity';
import { LogEntity } from './entities/log.entity';
import { TokenContractEntity } from './entities/token-contract.entity';
import { TokenTransferEntity } from './entities/token-transfer.entity';
import { SyncCheckpointEntity } from './entities/sync-checkpoint.entity';
import { BackfillJobEntity } from './entities/backfill-job.entity';
import { ReorgEventEntity } from './entities/reorg-event.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'blockchain_indexer',
  entities: [
    BlockEntity,
    TransactionEntity,
    TransactionReceiptEntity,
    LogEntity,
    TokenContractEntity,
    TokenTransferEntity,
    SyncCheckpointEntity,
    BackfillJobEntity,
    ReorgEventEntity,
  ],
  migrations: ['libs/db/src/migrations/*.ts'],
});
