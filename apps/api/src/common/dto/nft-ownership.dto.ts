import { ApiProperty } from '@nestjs/swagger';

export class NftOwnershipDto {
  @ApiProperty({ example: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' })
  tokenAddress!: string;

  @ApiProperty({ example: '7090' })
  tokenId!: string;

  @ApiProperty({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  ownerAddress!: string;

  @ApiProperty({ example: '1', description: 'Balance quantity (1 for ERC-721, variable for ERC-1155)' })
  quantity!: string;

  @ApiProperty({ example: '22711829' })
  lastTransferBlock!: string;

  @ApiProperty()
  updatedAt!: Date;
}
