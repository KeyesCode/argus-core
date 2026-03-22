import { TransactionDto } from './transaction.dto';

export interface BlockDto {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  nonce?: string | null;
  miner?: string | null;
  difficulty?: string | null;
  totalDifficulty?: string | null;
  gasLimit: string;
  gasUsed: string;
  baseFeePerGas?: string | null;
  transactions: TransactionDto[];
}
