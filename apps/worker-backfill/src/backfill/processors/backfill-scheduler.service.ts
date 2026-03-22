import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BackfillRunnerService } from '../services/backfill-runner.service';

@Injectable()
export class BackfillSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BackfillSchedulerService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly backfillRunner: BackfillRunnerService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Starting backfill scheduler');
    this.scheduleNext();
  }

  private scheduleNext(): void {
    this.timer = setTimeout(async () => {
      try {
        const hadWork = await this.backfillRunner.processNextJob();

        if (hadWork) {
          // Job completed or failed, check for next immediately
          this.scheduleNext();
          return;
        }
      } catch (error) {
        this.logger.error(`Backfill scheduler error: ${(error as Error).message}`);
      }

      // No active jobs, poll less frequently
      setTimeout(() => this.scheduleNext(), 30000);
    }, 5000);
  }
}
