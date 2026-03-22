import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class AddressParamDto {
  @ApiProperty({ description: 'Ethereum address (0x-prefixed, 42 chars)', example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/, { message: 'Invalid Ethereum address' })
  address!: string;
}

export class TxHashParamDto {
  @ApiProperty({ description: 'Transaction hash (0x-prefixed, 66 chars)', example: '0xdbaa547d4403b891af7e51f6eb84e067441ac6a5dcc2bf3fea25aab83b913b66' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'Invalid transaction hash' })
  hash!: string;
}

export class BlockIdentifierParamDto {
  @ApiProperty({ description: 'Block number or block hash', example: '22711829' })
  @IsString()
  numberOrHash!: string;
}
