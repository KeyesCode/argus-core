import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NftValidationIssueDto {
  @ApiProperty({ example: 'ERC721_OWNER_MISMATCH' })
  type!: string;

  @ApiProperty({ example: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' })
  tokenAddress!: string;

  @ApiPropertyOptional({ example: '7090' })
  tokenId?: string;

  @ApiPropertyOptional({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  ownerAddress?: string;

  @ApiPropertyOptional()
  expected?: string;

  @ApiPropertyOptional()
  actual?: string;

  @ApiPropertyOptional()
  detail?: string;
}

export class NftRebuildResultDto {
  @ApiProperty({ example: 'erc721_ownership' })
  table!: string;

  @ApiProperty({ example: 42 })
  rowsDeleted!: number;

  @ApiProperty({ example: 40 })
  rowsInserted!: number;

  @ApiProperty({ example: 150 })
  durationMs!: number;
}

export class NftValidationReportDto {
  @ApiProperty({ example: 3 })
  checkedContracts!: number;

  @ApiProperty({ example: 150 })
  checkedTokens!: number;

  @ApiProperty({ example: 2 })
  issuesFound!: number;

  @ApiProperty({ type: [NftValidationIssueDto] })
  issues!: NftValidationIssueDto[];

  @ApiProperty()
  startedAt!: Date;

  @ApiProperty()
  finishedAt!: Date;

  @ApiProperty({ example: 350 })
  durationMs!: number;
}

export class NftReconcileReportDto {
  @ApiProperty({ type: [NftRebuildResultDto] })
  rebuilds!: NftRebuildResultDto[];

  @ApiProperty({ type: NftValidationReportDto })
  validation!: NftValidationReportDto;

  @ApiProperty({ example: 500 })
  totalDurationMs!: number;
}
