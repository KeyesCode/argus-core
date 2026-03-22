import { Controller, Get, Post, Body, Param, Patch, Query, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { LimitQueryDto } from '../common/pagination';
import { CreateBackfillJobDto } from './dto/create-backfill-job.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get indexer status overview' })
  async getStatus() {
    return this.adminService.getStatus();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get indexer metrics for monitoring' })
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('checkpoints')
  @ApiOperation({ summary: 'Get per-worker sync checkpoints' })
  async getCheckpoints() {
    return this.adminService.getCheckpoints();
  }

  @Get('backfill-jobs')
  @ApiOperation({ summary: 'List all backfill jobs' })
  async getBackfillJobs() {
    return this.adminService.getBackfillJobs();
  }

  @Post('backfill-jobs')
  @ApiOperation({ summary: 'Create a new backfill job' })
  async createBackfillJob(@Body() dto: CreateBackfillJobDto) {
    return this.adminService.createBackfillJob(
      dto.fromBlock,
      dto.toBlock,
      dto.batchSize,
    );
  }

  @Patch('backfill-jobs/:id/pause')
  @ApiOperation({ summary: 'Pause a running backfill job' })
  async pauseJob(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.pauseJob(id);
  }

  @Patch('backfill-jobs/:id/resume')
  @ApiOperation({ summary: 'Resume a paused backfill job' })
  async resumeJob(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.resumeJob(id);
  }

  @Get('reorgs')
  @ApiOperation({ summary: 'Get recent chain reorganization events' })
  async getReorgEvents(@Query() query: LimitQueryDto) {
    return this.adminService.getReorgEvents(query.limit!);
  }
}
