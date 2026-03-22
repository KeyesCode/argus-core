import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MetricsService } from '@app/common';
import { BlockSyncService } from '../ingest/services/block-sync.service';

@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly blockSyncService: BlockSyncService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Starting block sync scheduler');
    this.scheduleNext();
  }

  private scheduleNext(): void {
    const intervalMs = Number(process.env.INGEST_POLL_INTERVAL_MS ?? 5000);

    this.timer = setTimeout(async () => {
      if (this.running) {
        this.scheduleNext();
        return;
      }

      this.running = true;

      try {
        const synced = await this.blockSyncService.syncNextBatch();

        // If we synced a full batch, immediately try again (catching up)
        if (synced > 0) {
          this.running = false;
          this.scheduleNext();
          return;
        }
      } catch (error) {
        this.metrics.increment('ingest.errors');
        this.metrics.recordError('ingest', (error as Error).message);
        this.logger.error(`Sync error: ${(error as Error).message}`);
      }

      this.running = false;
      this.scheduleNext();
    }, intervalMs);
  }
}
