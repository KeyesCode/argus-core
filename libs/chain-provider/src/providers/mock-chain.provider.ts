import { Injectable, Logger } from '@nestjs/common';
import { ChainProvider } from '../chain-provider.interface';
import { BlockDto } from '../dto/block.dto';
import { GetLogsDto } from '../dto/get-logs.dto';
import { LogDto } from '../dto/log.dto';
import { TransactionReceiptDto } from '../dto/transaction-receipt.dto';

@Injectable()
export class MockChainProvider implements ChainProvider {
  private readonly logger = new Logger(MockChainProvider.name);
  private currentBlock = 100;

  constructor() {
    this.logger.log('Mock chain provider initialized');
  }

  async getChainId(): Promise<number> {
    return 1;
  }

  async getLatestBlockNumber(): Promise<number> {
    return this.currentBlock;
  }

  async getBlockByNumber(blockNumber: number): Promise<BlockDto | null> {
    if (blockNumber > this.currentBlock) return null;

    return {
      number: blockNumber,
      hash: `0x${'0'.repeat(62)}${blockNumber.toString(16).padStart(2, '0')}`,
      parentHash: `0x${'0'.repeat(62)}${(blockNumber - 1).toString(16).padStart(2, '0')}`,
      timestamp: Math.floor(Date.now() / 1000) - (this.currentBlock - blockNumber) * 12,
      nonce: '0x0000000000000000',
      miner: '0x0000000000000000000000000000000000000000',
      difficulty: '0',
      totalDifficulty: null,
      gasLimit: '30000000',
      gasUsed: '0',
      baseFeePerGas: '1000000000',
      transactions: [],
    };
  }

  async getBlockWithTransactions(blockNumber: number): Promise<BlockDto | null> {
    return this.getBlockByNumber(blockNumber);
  }

  async getTransactionReceipt(_txHash: string): Promise<TransactionReceiptDto | null> {
    return null;
  }

  async getLogs(_params: GetLogsDto): Promise<LogDto[]> {
    return [];
  }
}
