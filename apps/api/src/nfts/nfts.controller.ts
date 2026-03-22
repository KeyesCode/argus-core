import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NftsService } from './nfts.service';
import { PaginationQueryDto, CursorQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';
import {
  NftTransferDto,
  Erc721OwnershipDto,
  ApiPaginatedResponse,
  ApiCursorPaginatedResponse,
} from '../common/dto';
import { NftTokenDetailDto } from './dto/nft-token-detail.dto';

@ApiTags('NFTs')
@Controller('nfts')
export class NftsController {
  constructor(private readonly nftsService: NftsService) {}

  @Get('collections/:address/transfers')
  @ApiOperation({ summary: 'Get cursor-paginated transfers for an NFT collection' })
  @ApiCursorPaginatedResponse(NftTransferDto)
  async getCollectionTransfers(
    @Param() params: AddressParamDto,
    @Query() query: CursorQueryDto,
  ) {
    return this.nftsService.getCollectionTransfers(
      params.address,
      query.limit!,
      query.cursor,
    );
  }

  @Get('collections/:address/tokens/:tokenId')
  @ApiOperation({ summary: 'Get NFT token details with metadata and owners' })
  @ApiOkResponse({ type: NftTokenDetailDto })
  async getToken(
    @Param('address') address: string,
    @Param('tokenId') tokenId: string,
  ) {
    return this.nftsService.getToken(address, tokenId);
  }

  @Get('collections/:address/tokens/:tokenId/transfers')
  @ApiOperation({ summary: 'Get cursor-paginated transfer history for a specific token' })
  @ApiCursorPaginatedResponse(NftTransferDto)
  async getTokenTransfers(
    @Param('address') address: string,
    @Param('tokenId') tokenId: string,
    @Query() query: CursorQueryDto,
  ) {
    return this.nftsService.getTokenTransfers(
      address,
      tokenId,
      query.limit!,
      query.cursor,
    );
  }

  @Get('collections/:address/tokens/:tokenId/owners')
  @ApiOperation({ summary: 'Get current owners of a token (ERC-1155 may have multiple)' })
  @ApiPaginatedResponse(Erc721OwnershipDto)
  async getTokenOwners(
    @Param('address') address: string,
    @Param('tokenId') tokenId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.nftsService.getTokenOwners(
      address,
      tokenId,
      query.limit!,
      query.offset!,
    );
  }

  @Get('collections/:address/sales')
  @ApiOperation({ summary: 'Get cursor-paginated NFT sales for a collection' })
  async getCollectionSales(
    @Param() params: AddressParamDto,
    @Query() query: CursorQueryDto,
  ) {
    return this.nftsService.getCollectionSales(params.address, query.limit!, query.cursor);
  }
}
