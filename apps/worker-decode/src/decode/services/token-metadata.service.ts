import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, JsonRpcProvider } from 'ethers';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { ERC20_ABI } from '@app/abi';
import { withRetry } from '@app/common/utils/retry';

@Injectable()
export class TokenMetadataService {
  private readonly logger = new Logger(TokenMetadataService.name);
  private readonly provider: JsonRpcProvider | null;
  private readonly pendingFetches = new Set<string>();
  private readonly failedAddresses = new Set<string>();

  constructor(
    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
  }

  /**
   * Ensure token metadata exists for the given address.
   * Checks DB first, then fetches from chain with retry.
   * Caches failures in memory to avoid repeated RPC calls for non-ERC20 contracts.
   */
  async ensureTokenMetadata(
    tokenAddress: string,
  ): Promise<TokenContractEntity | null> {
    const normalized = tokenAddress.toLowerCase();

    const existing = await this.tokenRepo.findOne({
      where: { address: normalized },
    });
    if (existing) return existing;

    if (this.failedAddresses.has(normalized)) return null;
    if (this.pendingFetches.has(normalized)) return null;

    if (!this.provider) {
      return null;
    }

    this.pendingFetches.add(normalized);

    try {
      const contract = new Contract(normalized, ERC20_ABI, this.provider);

      const [name, symbol, decimals] = await Promise.allSettled([
        withRetry(() => contract.name() as Promise<string>, 2, 500),
        withRetry(() => contract.symbol() as Promise<string>, 2, 500),
        withRetry(() => contract.decimals() as Promise<bigint>, 2, 500),
      ]);

      // If all fail, likely not an ERC-20 contract
      if (
        name.status === 'rejected' &&
        symbol.status === 'rejected' &&
        decimals.status === 'rejected'
      ) {
        this.failedAddresses.add(normalized);
        return null;
      }

      const entity = this.tokenRepo.create({
        address: normalized,
        name: name.status === 'fulfilled' ? String(name.value) : null,
        symbol: symbol.status === 'fulfilled' ? String(symbol.value) : null,
        decimals:
          decimals.status === 'fulfilled' ? Number(decimals.value) : null,
        totalSupply: null,
        standard: 'ERC20',
      });

      await this.tokenRepo.upsert(entity, ['address']);
      this.logger.log(
        `Indexed token: ${normalized} (${entity.symbol ?? 'unknown'})`,
      );

      return entity;
    } catch (error) {
      this.failedAddresses.add(normalized);
      this.logger.warn(
        `Failed token metadata for ${normalized}: ${(error as Error).message}`,
      );
      return null;
    } finally {
      this.pendingFetches.delete(normalized);
    }
  }

  /**
   * Batch-ensure metadata for multiple token addresses.
   */
  async ensureBatch(tokenAddresses: string[]): Promise<void> {
    const unique = [...new Set(tokenAddresses.map((a) => a.toLowerCase()))];
    for (const address of unique) {
      await this.ensureTokenMetadata(address);
    }
  }
}
