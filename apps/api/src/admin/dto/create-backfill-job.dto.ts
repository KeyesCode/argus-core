import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateBackfillJobDto {
  @ApiProperty({ description: 'Starting block number', example: 22700000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fromBlock!: number;

  @ApiProperty({ description: 'Ending block number (inclusive)', example: 22700099 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  toBlock!: number;

  @ApiPropertyOptional({ description: 'Blocks per batch', default: 250, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchSize?: number;
}
