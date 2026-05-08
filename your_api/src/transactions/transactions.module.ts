import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { TransactionProcessor } from './transaction.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    HttpModule,
    BullModule.registerQueue({
      name: 'transaction-status',
    }),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionProcessor],
})
export class TransactionsModule {}
