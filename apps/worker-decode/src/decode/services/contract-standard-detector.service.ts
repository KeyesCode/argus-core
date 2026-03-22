import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, JsonRpcProvider } from 'ethers';
import { ContractStandardEntity } from '@app/db/entities/contract-standard.entity';
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
    @InjectRepository(ContractStandardEntity)
    private readonly standardRepo: Repository<ContractStandardEntity>,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
  }

  /**
   * Detect the standard of a contract address.
   * Precedence: 1) in-memory cache, 2) DB persistence, 3) ERC-165 probe, 4) UNKNOWN
   */
  async detectStandard(address: string): Promise<ContractStandard> {
    const normalized = address.toLowerCase();

    const cached = this.cache.get(normalized);
    if (cached) return cached;

    // DB-backed persistence
    const persisted = await this.standardRepo.findOne({
      where: { address: normalized },
    });
    if (persisted) {
      const std = persisted.standard as ContractStandard;
      this.cache.set(normalized, std);
      return std;
    }

    // Probe via ERC-165
    if (this.pending.has(normalized) || !this.provider) {
      return 'UNKNOWN';
    }

    this.pending.add(normalized);
    try {
      const result = await this.probeErc165(normalized);
      this.cache.set(normalized, result.standard);

      // Persist to DB
      await this.standardRepo.upsert(
        {
          address: normalized,
          standard: result.standard,
          detectionMethod: result.method,
          supportsErc165: result.supportsErc165,
          supportsErc721: result.supportsErc721,
          supportsErc1155: result.supportsErc1155,
          updatedAt: new Date(),
        },
        ['address'],
      );

      return result.standard;
    } catch {
      return 'UNKNOWN';
    } finally {
      this.pending.delete(normalized);
    }
  }

  /**
   * Classify a Transfer log using topic count + contract standard.
   */
  async classifyTransferLog(
    contractAddress: string,
    topicCount: number,
  ): Promise<'ERC20' | 'ERC721'> {
    if (topicCount === 3) return 'ERC20';
    if (topicCount === 4) {
      const standard = await this.detectStandard(contractAddress);
      if (standard === 'ERC20') return 'ERC20';
      return 'ERC721';
    }
    return 'ERC20';
  }

  private async probeErc165(
    address: string,
  ): Promise<{
    standard: ContractStandard;
    method: string;
    supportsErc165: boolean | null;
    supportsErc721: boolean | null;
    supportsErc1155: boolean | null;
  }> {
    if (!this.provider) {
      return { standard: 'UNKNOWN', method: 'heuristic', supportsErc165: null, supportsErc721: null, supportsErc1155: null };
    }

    try {
      const contract = new Contract(address, ERC165_ABI, this.provider);

      const [isErc721, isErc1155] = await Promise.allSettled([
        contract.supportsInterface(ERC721_INTERFACE_ID) as Promise<boolean>,
        contract.supportsInterface(ERC1155_INTERFACE_ID) as Promise<boolean>,
      ]);

      const erc721 = isErc721.status === 'fulfilled' ? isErc721.value : null;
      const erc1155 = isErc1155.status === 'fulfilled' ? isErc1155.value : null;
      const erc165 = erc721 !== null || erc1155 !== null;

      let standard: ContractStandard = 'UNKNOWN';
      if (erc721 === true) standard = 'ERC721';
      else if (erc1155 === true) standard = 'ERC1155';
      else if (erc165) standard = 'ERC20';

      return {
        standard,
        method: erc165 ? 'erc165' : 'heuristic',
        supportsErc165: erc165,
        supportsErc721: erc721,
        supportsErc1155: erc1155,
      };
    } catch {
      return { standard: 'UNKNOWN', method: 'heuristic', supportsErc165: null, supportsErc721: null, supportsErc1155: null };
    }
  }
}
