import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokensService } from './tokens.service';
import { PaginationQueryDto, LimitQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';

@ApiTags('Tokens')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  @ApiOperation({ summary: 'List indexed token contracts' })
  async listTokens(@Query() query: LimitQueryDto) {
    return this.tokensService.listTokens(query.limit!);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get token contract with recent transfers' })
  async getToken(@Param() params: AddressParamDto) {
    return this.tokensService.getToken(params.address);
  }

  @Get(':address/transfers')
  @ApiOperation({ summary: 'Get paginated transfers for a token' })
  async getTokenTransfers(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tokensService.getTokenTransfers(
      params.address,
      query.limit!,
      query.offset!,
    );
  }
}
