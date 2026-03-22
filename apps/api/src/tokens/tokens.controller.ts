import { Controller, Get, Param, Query } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { parsePagination } from '../common/pagination';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  async listTokens(@Query('limit') limit?: string) {
    const { take } = parsePagination(limit);
    return this.tokensService.listTokens(take);
  }

  @Get(':address')
  async getToken(@Param('address') address: string) {
    return this.tokensService.getToken(address);
  }

  @Get(':address/transfers')
  async getTokenTransfers(
    @Param('address') address: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { take, skip } = parsePagination(limit, offset);
    return this.tokensService.getTokenTransfers(address, take, skip);
  }
}
