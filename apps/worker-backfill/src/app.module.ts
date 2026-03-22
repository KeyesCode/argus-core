import { Module } from '@nestjs/common';
import { DbModule } from '@app/db';
import { ChainProviderModule } from '@app/chain-provider';
import { QueueModule } from '@app/queue';
import { MetricsModule } from '@app/common';
import { BackfillModule } from './backfill/backfill.module';
import { BackfillSchedulerService } from './backfill/processors/backfill-scheduler.service';

@Module({
  imports: [DbModule, ChainProviderModule, QueueModule, MetricsModule, BackfillModule],
  providers: [BackfillSchedulerService],
})
export class AppModule {}
