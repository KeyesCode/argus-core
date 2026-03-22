import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class LimitQueryDto {
  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export class CursorQueryDto {
  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Cursor for next page (block_number:log_index)' })
  @IsOptional()
  cursor?: string;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  limit: number;
}

export function parseCursor(cursor?: string): { blockNumber: string; logIndex: number } | null {
  if (!cursor) return null;
  const parts = cursor.split(':');
  if (parts.length !== 2) return null;
  return { blockNumber: parts[0], logIndex: Number(parts[1]) };
}

export function buildCursor(blockNumber: string, logIndex: number): string {
  return `${blockNumber}:${logIndex}`;
}
