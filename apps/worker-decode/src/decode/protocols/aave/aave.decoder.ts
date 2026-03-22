import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AbiCoder } from 'ethers';
import { LogEntity } from '@app/db/entities/log.entity';
import { LendingEventEntity } from '@app/db/entities/lending-event.entity';
import { ProtocolDecoder } from '../protocol-decoder.interface';
import { ProtocolRegistryService } from '../protocol-registry.service';
import {
  AAVE_V2_DEPOSIT_TOPIC,
  AAVE_V2_WITHDRAW_TOPIC,
  AAVE_V2_BORROW_TOPIC,
  AAVE_V2_REPAY_TOPIC,
  AAVE_V2_LIQUIDATION_TOPIC,
  AAVE_V3_SUPPLY_TOPIC,
  ALL_AAVE_TOPICS,
  PROTOCOL_NAME,
} from './constants';

@Injectable()
export class AaveDecoder implements ProtocolDecoder, OnModuleInit {
  readonly protocol = PROTOCOL_NAME;
  private readonly logger = new Logger(AaveDecoder.name);

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
      where: ALL_AAVE_TOPICS.map((topic) => ({
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
        this.logger.warn(`Failed to decode Aave event ${log.transactionHash}:${log.logIndex}`);
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

      this.logger.debug(`Block ${blockNumber}: decoded ${inserts.length} Aave events`);
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
    };

    switch (log.topic0) {
      case AAVE_V2_DEPOSIT_TOPIC:
      case AAVE_V3_SUPPLY_TOPIC:
        return this.decodeDeposit(log, base);
      case AAVE_V2_WITHDRAW_TOPIC:
        return this.decodeWithdraw(log, base);
      case AAVE_V2_BORROW_TOPIC:
        return this.decodeBorrow(log, base);
      case AAVE_V2_REPAY_TOPIC:
        return this.decodeRepay(log, base);
      case AAVE_V2_LIQUIDATION_TOPIC:
        return this.decodeLiquidation(log, base);
      default:
        return null;
    }
  }

  /**
   * Deposit(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referral)
   * Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referral)
   * Topics: [sig, reserve, onBehalfOf, referral]
   * Data: [user, amount]
   */
  private decodeDeposit(log: LogEntity, base: any): Partial<LendingEventEntity> {
    if (!log.topic1 || !log.topic2) return base;

    const decoded = AbiCoder.defaultAbiCoder().decode(['address', 'uint256'], log.data);

    return {
      ...base,
      eventType: 'DEPOSIT',
      assetAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(),
      userAddress: (decoded[0] as string).toLowerCase(),
      onBehalfOf: `0x${log.topic2.slice(-40)}`.toLowerCase(),
      amount: decoded[1].toString(),
      rateMode: null,
      borrowRate: null,
      collateralAsset: null,
      debtToCover: null,
      liquidatedCollateral: null,
      liquidatorAddress: null,
    };
  }

  /**
   * Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)
   * Topics: [sig, reserve, user, to]
   * Data: [amount]
   */
  private decodeWithdraw(log: LogEntity, base: any): Partial<LendingEventEntity> {
    if (!log.topic1 || !log.topic2) return base;

    const decoded = AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);

    return {
      ...base,
      eventType: 'WITHDRAW',
      assetAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(),
      userAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(),
      onBehalfOf: log.topic3 ? `0x${log.topic3.slice(-40)}`.toLowerCase() : null,
      amount: decoded[0].toString(),
      rateMode: null,
      borrowRate: null,
      collateralAsset: null,
      debtToCover: null,
      liquidatedCollateral: null,
      liquidatorAddress: null,
    };
  }

  /**
   * Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint256 borrowRateMode, uint256 borrowRate, uint16 indexed referral)
   * Topics: [sig, reserve, onBehalfOf, referral]
   * Data: [user, amount, borrowRateMode, borrowRate]
   */
  private decodeBorrow(log: LogEntity, base: any): Partial<LendingEventEntity> {
    if (!log.topic1 || !log.topic2) return base;

    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['address', 'uint256', 'uint256', 'uint256'],
      log.data,
    );

    return {
      ...base,
      eventType: 'BORROW',
      assetAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(),
      userAddress: (decoded[0] as string).toLowerCase(),
      onBehalfOf: `0x${log.topic2.slice(-40)}`.toLowerCase(),
      amount: decoded[1].toString(),
      rateMode: Number(decoded[2]),
      borrowRate: decoded[3].toString(),
      collateralAsset: null,
      debtToCover: null,
      liquidatedCollateral: null,
      liquidatorAddress: null,
    };
  }

  /**
   * Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount, bool useATokens)
   * Topics: [sig, reserve, user, repayer]
   * Data: [amount, useATokens]
   */
  private decodeRepay(log: LogEntity, base: any): Partial<LendingEventEntity> {
    if (!log.topic1 || !log.topic2) return base;

    const decoded = AbiCoder.defaultAbiCoder().decode(['uint256', 'bool'], log.data);

    return {
      ...base,
      eventType: 'REPAY',
      assetAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(),
      userAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(),
      onBehalfOf: log.topic3 ? `0x${log.topic3.slice(-40)}`.toLowerCase() : null,
      amount: decoded[0].toString(),
      rateMode: null,
      borrowRate: null,
      collateralAsset: null,
      debtToCover: null,
      liquidatedCollateral: null,
      liquidatorAddress: null,
    };
  }

  /**
   * LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user,
   *   uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)
   * Topics: [sig, collateralAsset, debtAsset, user]
   * Data: [debtToCover, liquidatedCollateralAmount, liquidator, receiveAToken]
   */
  private decodeLiquidation(log: LogEntity, base: any): Partial<LendingEventEntity> {
    if (!log.topic1 || !log.topic2 || !log.topic3) return base;

    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['uint256', 'uint256', 'address', 'bool'],
      log.data,
    );

    return {
      ...base,
      eventType: 'LIQUIDATION',
      collateralAsset: `0x${log.topic1.slice(-40)}`.toLowerCase(),
      assetAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(), // debt asset
      userAddress: `0x${log.topic3.slice(-40)}`.toLowerCase(), // liquidated user
      amount: decoded[0].toString(), // debtToCover
      debtToCover: decoded[0].toString(),
      liquidatedCollateral: decoded[1].toString(),
      liquidatorAddress: (decoded[2] as string).toLowerCase(),
      onBehalfOf: null,
      rateMode: null,
      borrowRate: null,
    };
  }
}
