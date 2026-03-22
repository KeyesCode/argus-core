import { Module } from '@nestjs/common';
import { DbModule } from '@app/db';
import { ChainProviderModule } from '@app/chain-provider';
import { QueueModule } from '@app/queue';
import { MetricsModule } from '@app/common';
import { IngestModule } from './ingest/ingest.module';
import { SyncSchedulerService } from './scheduler/sync-scheduler.service';

@Module({
  imports: [DbModule, ChainProviderModule, QueueModule, MetricsModule, IngestModule],
  providers: [SyncSchedulerService],
})
export class AppModule {}
