import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { parsePagination } from '../common/pagination';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get('latest')
  async getLatestBlocks(@Query('limit') limit?: string) {
    const { take } = parsePagination(limit);
    return this.blocksService.getLatestBlocks(take);
  }

  @Get(':numberOrHash')
  async getBlock(@Param('numberOrHash') numberOrHash: string) {
    return this.blocksService.getBlock(numberOrHash);
  }
}
