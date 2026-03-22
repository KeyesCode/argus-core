import { Module } from '@nestjs/common';
import { DbModule } from '@app/db';
import { QueueModule } from '@app/queue';
import { MetricsModule } from '@app/common';
import { DecodeModule } from './decode/decode.module';

@Module({
  imports: [DbModule, QueueModule, MetricsModule, DecodeModule],
})
export class AppModule {}
