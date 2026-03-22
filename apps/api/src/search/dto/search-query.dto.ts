import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search query: tx hash, block hash, address, or block number', example: '22711829' })
  @IsString()
  @IsNotEmpty({ message: 'Query parameter "q" is required' })
  q!: string;
}
