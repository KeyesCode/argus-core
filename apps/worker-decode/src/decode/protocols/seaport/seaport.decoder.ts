import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbiCoder } from 'ethers';
import { LogEntity } from '@app/db/entities/log.entity';
import { NftSaleEntity } from '@app/db/entities/nft-sale.entity';
import { ProtocolDecoder } from '../protocol-decoder.interface';
import { ProtocolRegistryService } from '../protocol-registry.service';
import {
  SEAPORT_ORDER_FULFILLED_TOPIC,
  ITEM_TYPE_ETH,
  ITEM_TYPE_ERC20,
  ITEM_TYPE_ERC721,
  ITEM_TYPE_ERC1155,
  ETH_ADDRESS,
  PROTOCOL_NAME,
} from './constants';

// Seaport SpentItem/ReceivedItem tuple types for ABI decoding
const OFFER_TUPLE = 'tuple(uint8 itemType, address token, uint256 identifier, uint256 amount)[]';
const CONSIDERATION_TUPLE = 'tuple(uint8 itemType, address token, uint256 identifier, uint256 amount, address recipient)[]';

interface SpentItem {
  itemType: number;
  token: string;
  identifier: bigint;
  amount: bigint;
}

interface ReceivedItem {
  itemType: number;
  token: string;
  identifier: bigint;
  amount: bigint;
  recipient: string;
}

@Injectable()
export class SeaportDecoder implements ProtocolDecoder, OnModuleInit {
  readonly protocol = PROTOCOL_NAME;
  private readonly logger = new Logger(SeaportDecoder.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(NftSaleEntity)
    private readonly saleRepo: Repository<NftSaleEntity>,

    private readonly registry: ProtocolRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async decodeBlock(blockNumber: number): Promise<number> {
    const logs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: SEAPORT_ORDER_FULFILLED_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    if (logs.length === 0) return 0;

    const inserts: Partial<NftSaleEntity>[] = [];

    for (const log of logs) {
      try {
        const sales = this.decodeOrderFulfilled(log);
        inserts.push(...sales);
      } catch {
        this.logger.warn(
          `Failed to decode Seaport OrderFulfilled ${log.transactionHash}:${log.logIndex}`,
        );
      }
    }

    if (inserts.length > 0) {
      await this.saleRepo
        .createQueryBuilder()
        .insert()
        .into(NftSaleEntity)
        .values(inserts)
        .orIgnore()
        .execute();

      this.logger.debug(
        `Block ${blockNumber}: decoded ${inserts.length} Seaport NFT sales`,
      );
    }

    return inserts.length;
  }

  async rollbackFrom(blockNumber: number): Promise<void> {
    await this.saleRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :bn AND "protocol_name" = :proto', {
        bn: String(blockNumber),
        proto: PROTOCOL_NAME,
      })
      .execute();
  }

  /**
   * Decode an OrderFulfilled event into NFT sale(s).
   *
   * OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone,
   *   address recipient, SpentItem[] offer, ReceivedItem[] consideration)
   *
   * Topics: [sig, offerer, zone]
   * Data: [orderHash, recipient, offer[], consideration[]]
   *
   * Sale detection:
   * - If offer contains NFT(s) and consideration contains ETH/ERC20 → offerer is seller
   * - If consideration contains NFT(s) and offer contains ETH/ERC20 → offerer is buyer
   */
  private decodeOrderFulfilled(log: LogEntity): Partial<NftSaleEntity>[] {
    if (!log.topic1 || !log.topic2) return [];

    const offerer = `0x${log.topic1.slice(-40)}`.toLowerCase();

    // Decode non-indexed data: orderHash, recipient, offer[], consideration[]
    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['bytes32', 'address', OFFER_TUPLE, CONSIDERATION_TUPLE],
      log.data,
    );

    const orderHash: string = decoded[0];
    const recipient: string = (decoded[1] as string).toLowerCase();
    const offer: SpentItem[] = (decoded[2] as any[]).map((item) => ({
      itemType: Number(item[0]),
      token: (item[1] as string).toLowerCase(),
      identifier: BigInt(item[2]),
      amount: BigInt(item[3]),
    }));
    const consideration: ReceivedItem[] = (decoded[3] as any[]).map((item) => ({
      itemType: Number(item[0]),
      token: (item[1] as string).toLowerCase(),
      identifier: BigInt(item[2]),
      amount: BigInt(item[3]),
      recipient: (item[4] as string).toLowerCase(),
    }));

    const sales: Partial<NftSaleEntity>[] = [];

    // Find NFTs in offer (offerer is selling)
    const offerNfts = offer.filter(
      (i) => i.itemType === ITEM_TYPE_ERC721 || i.itemType === ITEM_TYPE_ERC1155,
    );
    const considerationPayments = consideration.filter(
      (i) => i.itemType === ITEM_TYPE_ETH || i.itemType === ITEM_TYPE_ERC20,
    );

    if (offerNfts.length > 0 && considerationPayments.length > 0) {
      // Total payment: sum all ETH/ERC20 in consideration going to the offerer
      const sellerPayments = considerationPayments.filter(
        (p) => p.recipient === offerer,
      );
      const totalPrice = sellerPayments.reduce((sum, p) => sum + p.amount, 0n);
      const paymentToken = considerationPayments[0].token;

      for (const nft of offerNfts) {
        sales.push({
          protocolName: PROTOCOL_NAME,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          orderHash: orderHash.toLowerCase(),
          collectionAddress: nft.token,
          tokenId: nft.identifier.toString(),
          tokenStandard: nft.itemType === ITEM_TYPE_ERC721 ? 'ERC721' : 'ERC1155',
          quantity: nft.amount.toString(),
          sellerAddress: offerer,
          buyerAddress: recipient,
          paymentToken: paymentToken === ETH_ADDRESS ? ETH_ADDRESS : paymentToken,
          totalPrice: totalPrice.toString(),
        });
      }
      return sales;
    }

    // Find NFTs in consideration (offerer is buying)
    const considerationNfts = consideration.filter(
      (i) => i.itemType === ITEM_TYPE_ERC721 || i.itemType === ITEM_TYPE_ERC1155,
    );
    const offerPayments = offer.filter(
      (i) => i.itemType === ITEM_TYPE_ETH || i.itemType === ITEM_TYPE_ERC20,
    );

    if (considerationNfts.length > 0 && offerPayments.length > 0) {
      const totalPrice = offerPayments.reduce((sum, p) => sum + p.amount, 0n);
      const paymentToken = offerPayments[0].token;

      for (const nft of considerationNfts) {
        sales.push({
          protocolName: PROTOCOL_NAME,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          orderHash: orderHash.toLowerCase(),
          collectionAddress: nft.token,
          tokenId: nft.identifier.toString(),
          tokenStandard: nft.itemType === ITEM_TYPE_ERC721 ? 'ERC721' : 'ERC1155',
          quantity: nft.amount.toString(),
          sellerAddress: nft.recipient,
          buyerAddress: offerer,
          paymentToken: paymentToken === ETH_ADDRESS ? ETH_ADDRESS : paymentToken,
          totalPrice: totalPrice.toString(),
        });
      }
    }

    return sales;
  }
}
