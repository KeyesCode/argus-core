import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, JsonRpcProvider } from 'ethers';
import {
  NftTokenMetadataEntity,
  NftMetadataStatus,
} from '@app/db/entities/nft-token-metadata.entity';
import { ERC721_ABI, ERC1155_ABI } from '@app/abi';

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

@Injectable()
export class NftMetadataService {
  private readonly logger = new Logger(NftMetadataService.name);
  private readonly provider: JsonRpcProvider | null;
  private readonly ipfsGateway: string;
  private readonly pending = new Set<string>();

  constructor(
    @InjectRepository(NftTokenMetadataEntity)
    private readonly metadataRepo: Repository<NftTokenMetadataEntity>,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
    this.ipfsGateway = process.env.NFT_IPFS_GATEWAY || DEFAULT_IPFS_GATEWAY;
  }

  /**
   * Ensure metadata exists for a token. Creates a PENDING row if new,
   * then attempts to fetch if status is PENDING or RETRYABLE.
   * Fire-and-forget safe — never throws.
   */
  async ensureMetadata(
    tokenAddress: string,
    tokenId: string,
    tokenType: string,
  ): Promise<void> {
    const key = `${tokenAddress}:${tokenId}`;
    if (this.pending.has(key)) return;

    const normalized = tokenAddress.toLowerCase();

    let existing = await this.metadataRepo.findOne({
      where: { tokenAddress: normalized, tokenId },
    });

    if (!existing) {
      existing = this.metadataRepo.create({
        tokenAddress: normalized,
        tokenId,
        fetchStatus: NftMetadataStatus.PENDING,
        fetchAttempts: 0,
      });
      await this.metadataRepo.upsert(existing, ['tokenAddress', 'tokenId']);
    }

    // Only fetch if pending/retryable and under max attempts
    if (
      existing.fetchStatus !== NftMetadataStatus.PENDING &&
      existing.fetchStatus !== NftMetadataStatus.RETRYABLE
    ) {
      return;
    }
    if (existing.fetchAttempts >= MAX_ATTEMPTS) {
      await this.metadataRepo.update(
        { tokenAddress: normalized, tokenId },
        { fetchStatus: NftMetadataStatus.FAILED },
      );
      return;
    }

    this.pending.add(key);
    try {
      await this.fetchAndStore(normalized, tokenId, tokenType);
    } catch (error) {
      this.logger.warn(
        `Metadata fetch failed for ${normalized}:${tokenId}: ${(error as Error).message}`,
      );
    } finally {
      this.pending.delete(key);
    }
  }

  /**
   * Batch ensure metadata for multiple tokens.
   */
  async ensureBatch(
    items: Array<{ tokenAddress: string; tokenId: string; tokenType: string }>,
  ): Promise<void> {
    const unique = new Map<string, (typeof items)[0]>();
    for (const item of items) {
      unique.set(`${item.tokenAddress.toLowerCase()}:${item.tokenId}`, item);
    }
    for (const item of unique.values()) {
      await this.ensureMetadata(item.tokenAddress, item.tokenId, item.tokenType);
    }
  }

  /**
   * Resolve a URI to an HTTP URL.
   * Handles ipfs://, ar://, data:, and http(s):// URIs.
   */
  resolveUri(uri: string): string {
    if (!uri) return uri;

    const trimmed = uri.trim();

    // IPFS
    if (trimmed.startsWith('ipfs://')) {
      return `${this.ipfsGateway}${trimmed.slice(7)}`;
    }

    // Arweave
    if (trimmed.startsWith('ar://')) {
      return `https://arweave.net/${trimmed.slice(5)}`;
    }

    // Already HTTP
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // Data URI — return as-is
    if (trimmed.startsWith('data:')) {
      return trimmed;
    }

    // Bare CID (starts with Qm or ba)
    if (trimmed.startsWith('Qm') || trimmed.startsWith('ba')) {
      return `${this.ipfsGateway}${trimmed}`;
    }

    return trimmed;
  }

  private async fetchAndStore(
    tokenAddress: string,
    tokenId: string,
    tokenType: string,
  ): Promise<void> {
    if (!this.provider) return;

    // Update status to FETCHING
    await this.metadataRepo.update(
      { tokenAddress, tokenId },
      {
        fetchStatus: NftMetadataStatus.FETCHING,
        fetchAttempts: () => '"fetch_attempts" + 1',
        lastFetchAt: new Date(),
      } as any,
    );

    // Step 1: Get tokenURI from contract
    let tokenUri: string | null = null;
    try {
      const abi = tokenType === 'ERC1155' ? ERC1155_ABI : ERC721_ABI;
      const method = tokenType === 'ERC1155' ? 'uri' : 'tokenURI';
      const contract = new Contract(tokenAddress, abi, this.provider);
      tokenUri = await contract[method](BigInt(tokenId)) as string;
    } catch {
      await this.metadataRepo.update(
        { tokenAddress, tokenId },
        { fetchStatus: NftMetadataStatus.RETRYABLE },
      );
      return;
    }

    if (!tokenUri) {
      await this.metadataRepo.update(
        { tokenAddress, tokenId },
        { fetchStatus: NftMetadataStatus.FAILED, tokenUri: null },
      );
      return;
    }

    // ERC-1155 URI substitution: replace {id} with hex tokenId
    if (tokenUri.includes('{id}')) {
      tokenUri = tokenUri.replace(
        '{id}',
        BigInt(tokenId).toString(16).padStart(64, '0'),
      );
    }

    const resolvedUrl = this.resolveUri(tokenUri);

    // Step 2: Fetch metadata JSON
    let metadataJson: any = null;
    let name: string | null = null;
    let description: string | null = null;
    let imageUrl: string | null = null;

    try {
      if (resolvedUrl.startsWith('data:application/json')) {
        // Data URI — decode inline
        const base64Match = resolvedUrl.match(/base64,(.+)/);
        if (base64Match) {
          metadataJson = JSON.parse(Buffer.from(base64Match[1], 'base64').toString());
        } else {
          const jsonMatch = resolvedUrl.match(/,(.+)/);
          if (jsonMatch) {
            metadataJson = JSON.parse(decodeURIComponent(jsonMatch[1]));
          }
        }
      } else if (resolvedUrl.startsWith('http')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const response = await fetch(resolvedUrl, { signal: controller.signal });
          if (response.ok) {
            metadataJson = await response.json();
          }
        } finally {
          clearTimeout(timeout);
        }
      }
    } catch {
      // Bad JSON or network failure — still save the URI
    }

    // Extract normalized fields from metadata
    if (metadataJson && typeof metadataJson === 'object') {
      name = typeof metadataJson.name === 'string' ? metadataJson.name.slice(0, 255) : null;
      description = typeof metadataJson.description === 'string' ? metadataJson.description : null;
      const rawImage = metadataJson.image || metadataJson.image_url || metadataJson.image_data;
      imageUrl = typeof rawImage === 'string' ? this.resolveUri(rawImage) : null;
    }

    await this.metadataRepo.update(
      { tokenAddress, tokenId },
      {
        tokenUri,
        metadataJson,
        name,
        description,
        imageUrl,
        fetchStatus: metadataJson ? NftMetadataStatus.SUCCESS : NftMetadataStatus.RETRYABLE,
      },
    );

    if (metadataJson) {
      this.logger.debug(`Fetched metadata for ${tokenAddress}:${tokenId} (${name})`);
    }
  }
}
