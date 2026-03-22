import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.DECODE_LOGS },
      { name: QUEUE_NAMES.BACKFILL_RANGE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
