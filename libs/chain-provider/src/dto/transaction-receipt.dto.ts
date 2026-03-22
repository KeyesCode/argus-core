import { LogDto } from './log.dto';

export interface TransactionReceiptDto {
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  contractAddress: string | null;
  cumulativeGasUsed: string;
  gasUsed: string;
  effectiveGasPrice?: string | null;
  status: number;
  logs: LogDto[];
}
