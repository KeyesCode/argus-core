import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { LimitQueryDto } from '../common/pagination';
import { BlockIdentifierParamDto } from '../common/params';

@ApiTags('Blocks')
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get latest indexed blocks' })
  async getLatestBlocks(@Query() query: LimitQueryDto) {
    return this.blocksService.getLatestBlocks(query.limit!);
  }

  @Get(':numberOrHash')
  @ApiOperation({ summary: 'Get block by number or hash' })
  async getBlock(@Param() params: BlockIdentifierParamDto) {
    return this.blocksService.getBlock(params.numberOrHash);
  }
}
