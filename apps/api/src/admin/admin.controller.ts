import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { parsePagination } from '../common/pagination';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('status')
  async getStatus() {
    return this.adminService.getStatus();
  }

  @Get('metrics')
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('checkpoints')
  async getCheckpoints() {
    return this.adminService.getCheckpoints();
  }

  @Get('backfill-jobs')
  async getBackfillJobs() {
    return this.adminService.getBackfillJobs();
  }

  @Post('backfill-jobs')
  async createBackfillJob(
    @Body() body: { fromBlock: number; toBlock: number; batchSize?: number },
  ) {
    return this.adminService.createBackfillJob(
      body.fromBlock,
      body.toBlock,
      body.batchSize,
    );
  }

  @Patch('backfill-jobs/:id/pause')
  async pauseJob(@Param('id') id: number) {
    return this.adminService.pauseJob(id);
  }

  @Patch('backfill-jobs/:id/resume')
  async resumeJob(@Param('id') id: number) {
    return this.adminService.resumeJob(id);
  }

  @Get('reorgs')
  async getReorgEvents(@Query('limit') limit?: string) {
    const { take } = parsePagination(limit);
    return this.adminService.getReorgEvents(take);
  }
}
