import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbiCoder } from 'ethers';
import { LogEntity } from '@app/db/entities/log.entity';
import { LendingEventEntity } from '@app/db/entities/lending-event.entity';
import { ProtocolDecoder } from '../protocol-decoder.interface';
import { ProtocolRegistryService } from '../protocol-registry.service';
import {
  ERC4626_DEPOSIT_TOPIC,
  ERC4626_WITHDRAW_TOPIC,
  ALL_ERC4626_TOPICS,
  PROTOCOL_NAME,
} from './constants';

@Injectable()
export class Erc4626Decoder implements ProtocolDecoder, OnModuleInit {
  readonly protocol = PROTOCOL_NAME;
  private readonly logger = new Logger(Erc4626Decoder.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(LendingEventEntity)
    private readonly lendingRepo: Repository<LendingEventEntity>,

    private readonly registry: ProtocolRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async decodeBlock(blockNumber: number): Promise<number> {
    const logs = await this.logRepo.find({
      where: ALL_ERC4626_TOPICS.map((topic) => ({
        blockNumber: String(blockNumber),
        topic0: topic,
      })),
      order: { logIndex: 'ASC' },
    });

    if (logs.length === 0) return 0;

    const inserts: Partial<LendingEventEntity>[] = [];

    for (const log of logs) {
      try {
        const event = this.decodeLog(log);
        if (event) inserts.push(event);
      } catch {
        this.logger.warn(`Failed to decode ERC-4626 event ${log.transactionHash}:${log.logIndex}`);
      }
    }

    if (inserts.length > 0) {
      await this.lendingRepo
        .createQueryBuilder()
        .insert()
        .into(LendingEventEntity)
        .values(inserts)
        .orIgnore()
        .execute();

      this.logger.debug(`Block ${blockNumber}: decoded ${inserts.length} ERC-4626 events`);
    }

    return inserts.length;
  }

  async rollbackFrom(blockNumber: number): Promise<void> {
    await this.lendingRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :bn AND "protocol_name" = :proto', {
        bn: String(blockNumber),
        proto: PROTOCOL_NAME,
      })
      .execute();
  }

  private decodeLog(log: LogEntity): Partial<LendingEventEntity> | null {
    const base = {
      protocolName: PROTOCOL_NAME,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      assetAddress: log.address, // vault contract address
      rateMode: null,
      borrowRate: null,
      collateralAsset: null,
      debtToCover: null,
      liquidatedCollateral: null,
      liquidatorAddress: null,
    };

    switch (log.topic0) {
      case ERC4626_DEPOSIT_TOPIC:
        return this.decodeDeposit(log, base);
      case ERC4626_WITHDRAW_TOPIC:
        return this.decodeWithdraw(log, base);
      default:
        return null;
    }
  }

  /**
   * Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
   * Topics: [sig, sender, owner]
   * Data: [assets, shares]
   */
  private decodeDeposit(log: LogEntity, base: any): Partial<LendingEventEntity> {
    if (!log.topic1 || !log.topic2) return base;

    const decoded = AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], log.data);

    return {
      ...base,
      eventType: 'DEPOSIT',
      userAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(), // sender
      onBehalfOf: `0x${log.topic2.slice(-40)}`.toLowerCase(), // owner
      amount: decoded[0].toString(), // assets (underlying amount)
    };
  }

  /**
   * Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
   * Topics: [sig, sender, receiver, owner]
   * Data: [assets, shares]
   */
  private decodeWithdraw(log: LogEntity, base: any): Partial<LendingEventEntity> {
    if (!log.topic1 || !log.topic2) return base;

    const decoded = AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], log.data);

    return {
      ...base,
      eventType: 'WITHDRAW',
      userAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(), // sender
      onBehalfOf: log.topic3 ? `0x${log.topic3.slice(-40)}`.toLowerCase() : null, // owner
      amount: decoded[0].toString(), // assets (underlying amount)
    };
  }
}
