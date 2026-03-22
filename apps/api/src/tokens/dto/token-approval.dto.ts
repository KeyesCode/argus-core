import { ApiProperty } from '@nestjs/swagger';

export class TokenApprovalDto {
  @ApiProperty()
  transactionHash!: string;

  @ApiProperty()
  blockNumber!: string;

  @ApiProperty()
  logIndex!: number;

  @ApiProperty()
  tokenAddress!: string;

  @ApiProperty()
  ownerAddress!: string;

  @ApiProperty()
  spenderAddress!: string;

  @ApiProperty({ description: 'Approved amount (raw, not decimal-adjusted)' })
  valueRaw!: string;
}

export class TokenAllowanceDto {
  @ApiProperty()
  tokenAddress!: string;

  @ApiProperty()
  ownerAddress!: string;

  @ApiProperty()
  spenderAddress!: string;

  @ApiProperty({ description: 'Current allowance (raw)' })
  valueRaw!: string;

  @ApiProperty()
  lastApprovalBlock!: string;
}
