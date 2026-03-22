import { Injectable, Logger } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';
import { ChainProvider } from '../chain-provider.interface';
import { BlockDto } from '../dto/block.dto';
import { GetLogsDto } from '../dto/get-logs.dto';
import { LogDto } from '../dto/log.dto';
import { TransactionDto } from '../dto/transaction.dto';
import { TransactionReceiptDto } from '../dto/transaction-receipt.dto';

@Injectable()
export class RpcChainProvider implements ChainProvider {
  private readonly logger = new Logger(RpcChainProvider.name);
  private readonly provider: JsonRpcProvider;

  constructor() {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    if (!rpcUrl) {
      throw new Error('CHAIN_RPC_URL environment variable is required');
    }
    this.provider = new JsonRpcProvider(rpcUrl);
    this.logger.log(`RPC provider initialized: ${rpcUrl}`);
  }

  async getChainId(): Promise<number> {
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }

  async getLatestBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async getBlockByNumber(blockNumber: number): Promise<BlockDto | null> {
    const block = await this.provider.getBlock(blockNumber, false);
    if (!block) return null;

    return {
      number: block.number,
      hash: block.hash!,
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      nonce: block.nonce ?? null,
      miner: block.miner ?? null,
      difficulty: block.difficulty?.toString() ?? null,
      totalDifficulty: null,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
      baseFeePerGas: block.baseFeePerGas?.toString() ?? null,
      transactions: [],
    };
  }

  async getBlockWithTransactions(blockNumber: number): Promise<BlockDto | null> {
    const block = await this.provider.getBlock(blockNumber, true);
    if (!block) return null;

    const txs: TransactionDto[] = block.prefetchedTransactions.map((tx) => ({
      hash: tx.hash,
      blockNumber: tx.blockNumber!,
      transactionIndex: tx.index!,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      input: tx.data,
      nonce: tx.nonce,
      gas: tx.gasLimit.toString(),
      gasPrice: tx.gasPrice?.toString() ?? null,
      maxFeePerGas: tx.maxFeePerGas?.toString() ?? null,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString() ?? null,
      type: tx.type ?? null,
    }));

    return {
      number: block.number,
      hash: block.hash!,
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      nonce: block.nonce ?? null,
      miner: block.miner ?? null,
      difficulty: block.difficulty?.toString() ?? null,
      totalDifficulty: null,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
      baseFeePerGas: block.baseFeePerGas?.toString() ?? null,
      transactions: txs,
    };
  }

  async getTransactionReceipt(txHash: string): Promise<TransactionReceiptDto | null> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) return null;

    return {
      transactionHash: receipt.hash,
      transactionIndex: receipt.index,
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber,
      from: receipt.from,
      to: receipt.to,
      contractAddress: receipt.contractAddress,
      cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.gasPrice?.toString() ?? null,
      status: receipt.status ?? 0,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        logIndex: log.index,
        data: log.data,
        topics: [...log.topics],
        removed: !!log.removed,
      })),
    };
  }

  async getLogs(params: GetLogsDto): Promise<LogDto[]> {
    const logs = await this.provider.getLogs({
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
      address: params.address,
      topics: params.topics,
    });

    return logs.map((log) => ({
      address: log.address,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex,
      logIndex: log.index,
      data: log.data,
      topics: [...log.topics],
      removed: !!log.removed,
    }));
  }
}
