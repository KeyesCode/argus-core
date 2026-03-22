import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NftTokenMetadataDto {
  @ApiProperty({ example: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' })
  tokenAddress!: string;

  @ApiProperty({ example: '7090' })
  tokenId!: string;

  @ApiPropertyOptional({ example: 'ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/7090', nullable: true })
  tokenUri!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Raw metadata JSON from tokenURI' })
  metadataJson!: any;

  @ApiPropertyOptional({ example: 'Bored Ape #7090', nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ example: 'https://ipfs.io/ipfs/QmRRPWG96cmgTn2qSzjwr2qvfNEuhunv6FNeMFGa9bx6mQ', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ example: 'success', enum: ['pending', 'fetching', 'success', 'failed', 'retryable'] })
  fetchStatus!: string;

  @ApiProperty({ example: 1 })
  fetchAttempts!: number;

  @ApiPropertyOptional({ nullable: true })
  lastFetchAt!: Date | null;
}
