import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NftTokenMetadataDto } from '../../common/dto/nft-token-metadata.dto';
import { NftOwnershipDto } from '../../common/dto/nft-ownership.dto';
import { NftTransferDto } from '../../common/dto/nft-transfer.dto';

export class NftTokenDetailDto {
  @ApiProperty({ example: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' })
  tokenAddress!: string;

  @ApiProperty({ example: '7090' })
  tokenId!: string;

  @ApiPropertyOptional({ type: NftTokenMetadataDto, nullable: true })
  metadata!: NftTokenMetadataDto | null;

  @ApiProperty({ type: [NftOwnershipDto] })
  owners!: NftOwnershipDto[];

  @ApiProperty({ type: [NftTransferDto] })
  recentTransfers!: NftTransferDto[];
}
