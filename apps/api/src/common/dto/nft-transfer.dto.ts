import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NftTransferDto {
  @ApiProperty({ example: '0xdbaa547d4403b891af7e51f6eb84e067441ac6a5dcc2bf3fea25aab83b913b66' })
  transactionHash!: string;

  @ApiProperty({ example: '22711829' })
  blockNumber!: string;

  @ApiProperty({ example: 0 })
  logIndex!: number;

  @ApiProperty({ example: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' })
  tokenAddress!: string;

  @ApiProperty({ example: 'ERC721', enum: ['ERC721', 'ERC1155'] })
  tokenType!: string;

  @ApiProperty({ example: '0x0000000000000000000000000000000000000000' })
  fromAddress!: string;

  @ApiProperty({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  toAddress!: string;

  @ApiProperty({ example: '7090', description: 'Token ID as decimal string' })
  tokenId!: string;

  @ApiProperty({ example: '1', description: 'Quantity (always 1 for ERC-721, variable for ERC-1155)' })
  quantity!: string;

  @ApiPropertyOptional({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a', nullable: true, description: 'Operator address (ERC-1155 only)' })
  operator!: string | null;
}
