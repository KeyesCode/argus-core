import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { PaginationQueryDto, LimitQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';

@ApiTags('Addresses')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Get address overview with recent activity' })
  async getAddressOverview(
    @Param() params: AddressParamDto,
    @Query() query: LimitQueryDto,
  ) {
    return this.addressesService.getOverview(params.address, query.limit!);
  }

  @Get(':address/transactions')
  @ApiOperation({ summary: 'Get paginated transactions for an address' })
  async getAddressTransactions(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.addressesService.getTransactions(
      params.address,
      query.limit!,
      query.offset!,
    );
  }

  @Get(':address/token-transfers')
  @ApiOperation({ summary: 'Get paginated token transfers for an address' })
  async getAddressTokenTransfers(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.addressesService.getTokenTransfers(
      params.address,
      query.limit!,
      query.offset!,
    );
  }
}
