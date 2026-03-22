import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, JsonRpcProvider } from 'ethers';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { ERC20_ABI } from '@app/abi';

@Injectable()
export class TokenMetadataService {
  private readonly logger = new Logger(TokenMetadataService.name);
  private readonly provider: JsonRpcProvider | null;

  constructor(
    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
  }

  async ensureTokenMetadata(tokenAddress: string): Promise<TokenContractEntity | null> {
    const existing = await this.tokenRepo.findOne({
      where: { address: tokenAddress },
    });

    if (existing) return existing;

    if (!this.provider) {
      this.logger.warn('No RPC provider configured for token metadata');
      return null;
    }

    try {
      const contract = new Contract(tokenAddress, ERC20_ABI, this.provider);

      const [name, symbol, decimals] = await Promise.allSettled([
        contract.name() as Promise<string>,
        contract.symbol() as Promise<string>,
        contract.decimals() as Promise<bigint>,
      ]);

      const entity = this.tokenRepo.create({
        address: tokenAddress,
        name: name.status === 'fulfilled' ? name.value : null,
        symbol: symbol.status === 'fulfilled' ? symbol.value : null,
        decimals: decimals.status === 'fulfilled' ? Number(decimals.value) : null,
        totalSupply: null,
        standard: 'ERC20',
      });

      await this.tokenRepo.save(entity);
      this.logger.log(`Indexed token metadata: ${tokenAddress} (${entity.symbol})`);

      return entity;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch token metadata for ${tokenAddress}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
