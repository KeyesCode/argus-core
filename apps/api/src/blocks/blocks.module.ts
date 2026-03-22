import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockEntity, TransactionEntity])],
  controllers: [BlocksController],
  providers: [BlocksService],
})
export class BlocksModule {}
