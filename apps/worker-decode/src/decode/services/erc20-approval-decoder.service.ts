import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenApprovalEntity } from '@app/db/entities/token-approval.entity';
import { TokenAllowanceEntity } from '@app/db/entities/token-allowance.entity';
import { ERC20_APPROVAL_TOPIC } from '@app/abi';
import { MetricsService } from '@app/common';

@Injectable()
export class Erc20ApprovalDecoderService {
  private readonly logger = new Logger(Erc20ApprovalDecoderService.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenApprovalEntity)
    private readonly approvalRepo: Repository<TokenApprovalEntity>,

    @InjectRepository(TokenAllowanceEntity)
    private readonly allowanceRepo: Repository<TokenAllowanceEntity>,

    private readonly metrics: MetricsService,
  ) {}

  /**
   * Decode ERC-20 Approval events for a block.
   * Approval(address indexed owner, address indexed spender, uint256 value)
   * Topics: [sig, owner, spender], Data: [value]
   */
  async decodeBlock(blockNumber: number): Promise<number> {
    const logs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: ERC20_APPROVAL_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    const inserts: Partial<TokenApprovalEntity>[] = [];

    for (const log of logs) {
      // Approval has exactly 3 topics (sig + owner + spender) and value in data
      if (!log.topic1 || !log.topic2) continue;
      // Skip 4-topic approvals (non-standard)
      if (log.topic3) continue;

      const ownerAddress = `0x${log.topic1.slice(-40)}`.toLowerCase();
      const spenderAddress = `0x${log.topic2.slice(-40)}`.toLowerCase();

      let valueRaw: string;
      try {
        valueRaw = BigInt(log.data).toString();
      } catch {
        this.logger.warn(
          `Invalid approval data in log ${log.transactionHash}:${log.logIndex}`,
        );
        continue;
      }

      inserts.push({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        tokenAddress: log.address,
        ownerAddress,
        spenderAddress,
        valueRaw,
      });
    }

    // Persist approval events
    if (inserts.length > 0) {
      await this.approvalRepo
        .createQueryBuilder()
        .insert()
        .into(TokenApprovalEntity)
        .values(inserts)
        .orIgnore()
        .execute();

      // Update current allowance state — latest approval value wins
      for (const approval of inserts) {
        await this.allowanceRepo.upsert(
          {
            tokenAddress: approval.tokenAddress!,
            ownerAddress: approval.ownerAddress!,
            spenderAddress: approval.spenderAddress!,
            valueRaw: approval.valueRaw!,
            lastApprovalBlock: approval.blockNumber!,
            updatedAt: new Date(),
          },
          ['tokenAddress', 'ownerAddress', 'spenderAddress'],
        );
      }
    }

    this.metrics.increment('decode.approvals', inserts.length);

    if (inserts.length > 0) {
      this.logger.debug(
        `Block ${blockNumber}: decoded ${inserts.length} ERC-20 approvals`,
      );
    }

    return inserts.length;
  }
}
