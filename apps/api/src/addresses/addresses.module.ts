import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { AddressSummaryEntity } from '@app/db/entities/address-summary.entity';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionEntity, TokenTransferEntity, AddressSummaryEntity])],
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}
