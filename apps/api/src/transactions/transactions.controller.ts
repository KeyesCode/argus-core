import { Controller, Get, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(':hash')
  async getTransaction(@Param('hash') hash: string) {
    return this.transactionsService.getTransaction(hash);
  }
}
