import { BlockDto } from './dto/block.dto';
import { GetLogsDto } from './dto/get-logs.dto';
import { LogDto } from './dto/log.dto';
import { TransactionReceiptDto } from './dto/transaction-receipt.dto';

export const CHAIN_PROVIDER = 'CHAIN_PROVIDER';

export interface ChainProvider {
  getChainId(): Promise<number>;
  getLatestBlockNumber(): Promise<number>;
  getBlockByNumber(blockNumber: number): Promise<BlockDto | null>;
  getBlockWithTransactions(blockNumber: number): Promise<BlockDto | null>;
  getTransactionReceipt(txHash: string): Promise<TransactionReceiptDto | null>;
  getLogs(params: GetLogsDto): Promise<LogDto[]>;
}
