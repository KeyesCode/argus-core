import { Controller, Get, Param, Query } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { parsePagination } from '../common/pagination';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get(':address')
  async getAddressOverview(
    @Param('address') address: string,
    @Query('limit') limit?: string,
  ) {
    const { take } = parsePagination(limit);
    return this.addressesService.getOverview(address, take);
  }

  @Get(':address/transactions')
  async getAddressTransactions(
    @Param('address') address: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { take, skip } = parsePagination(limit, offset);
    return this.addressesService.getTransactions(address, take, skip);
  }

  @Get(':address/token-transfers')
  async getAddressTokenTransfers(
    @Param('address') address: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { take, skip } = parsePagination(limit, offset);
    return this.addressesService.getTokenTransfers(address, take, skip);
  }
}
