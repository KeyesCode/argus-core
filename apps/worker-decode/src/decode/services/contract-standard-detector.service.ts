import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, JsonRpcProvider } from 'ethers';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { ERC165_ABI } from '@app/abi';
import { ERC721_INTERFACE_ID, ERC1155_INTERFACE_ID } from '@app/abi';

export type ContractStandard = 'ERC20' | 'ERC721' | 'ERC1155' | 'UNKNOWN';

@Injectable()
export class ContractStandardDetectorService {
  private readonly logger = new Logger(ContractStandardDetectorService.name);
  private readonly provider: JsonRpcProvider | null;
  private readonly cache = new Map<string, ContractStandard>();
  private readonly pending = new Set<string>();

  constructor(
    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
  }

  /**
   * Detect the standard of a contract address.
   * 1. Check in-memory cache
   * 2. Check DB (token_contracts.standard)
   * 3. Probe ERC-165 supportsInterface
   * 4. Fall back to UNKNOWN
   */
  async detectStandard(address: string): Promise<ContractStandard> {
    const normalized = address.toLowerCase();

    // In-memory cache
    const cached = this.cache.get(normalized);
    if (cached) return cached;

    // DB cache
    const existing = await this.tokenRepo.findOne({
      where: { address: normalized },
    });
    if (existing && existing.standard !== 'ERC20') {
      // Only trust non-default values (ERC20 is the default, might be wrong)
      this.cache.set(normalized, existing.standard as ContractStandard);
      return existing.standard as ContractStandard;
    }

    // Probe via ERC-165 (don't block if already probing)
    if (this.pending.has(normalized) || !this.provider) {
      return 'UNKNOWN';
    }

    this.pending.add(normalized);
    try {
      const standard = await this.probeErc165(normalized);
      this.cache.set(normalized, standard);

      // Update DB if we found a definitive answer
      if (standard !== 'UNKNOWN') {
        await this.tokenRepo.upsert(
          {
            address: normalized,
            standard,
          },
          ['address'],
        );
      }

      return standard;
    } catch {
      return 'UNKNOWN';
    } finally {
      this.pending.delete(normalized);
    }
  }

  /**
   * Classify a Transfer log using topic count + contract standard.
   * Returns 'ERC20' or 'ERC721'.
   *
   * For 3-topic Transfer logs (value in data): always ERC-20.
   * For 4-topic Transfer logs (tokenId as topic3):
   *   - Check contract standard cache/probe
   *   - If confirmed ERC-20, treat as ERC-20 (rare non-standard case)
   *   - Otherwise, treat as ERC-721
   */
  async classifyTransferLog(
    contractAddress: string,
    topicCount: number,
  ): Promise<'ERC20' | 'ERC721'> {
    if (topicCount === 3) return 'ERC20';
    if (topicCount === 4) {
      const standard = await this.detectStandard(contractAddress);
      // If we confirmed it's ERC-20 via ERC-165, respect that
      if (standard === 'ERC20') return 'ERC20';
      // Otherwise treat 4-topic as ERC-721 (covers ERC721 and UNKNOWN)
      return 'ERC721';
    }
    return 'ERC20'; // shouldn't happen, but safe default
  }

  private async probeErc165(address: string): Promise<ContractStandard> {
    if (!this.provider) return 'UNKNOWN';

    try {
      const contract = new Contract(address, ERC165_ABI, this.provider);

      const [isErc721, isErc1155] = await Promise.allSettled([
        contract.supportsInterface(ERC721_INTERFACE_ID) as Promise<boolean>,
        contract.supportsInterface(ERC1155_INTERFACE_ID) as Promise<boolean>,
      ]);

      if (isErc721.status === 'fulfilled' && isErc721.value) return 'ERC721';
      if (isErc1155.status === 'fulfilled' && isErc1155.value) return 'ERC1155';

      // ERC-165 responded but no match — likely ERC-20 or non-standard
      if (isErc721.status === 'fulfilled' || isErc1155.status === 'fulfilled') {
        return 'ERC20';
      }

      return 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}
