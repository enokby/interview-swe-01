import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { lastValueFrom } from 'rxjs';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectQueue('transaction-status') private statusQueue: Queue,
  ) {}

  async create(createTransactionDto: CreateTransactionDto) {
    const { id } = createTransactionDto;

    // Check if transaction already exists (Idempotency)
    let transaction = await this.transactionsRepository.findOne({ where: { id } });
    if (transaction) {
      this.logger.log(`Transaction ${id} already exists with status ${transaction.status}`);
      return transaction;
    }

    // Create new pending transaction
    transaction = this.transactionsRepository.create({
      id,
      status: TransactionStatus.PENDING,
    });
    await this.transactionsRepository.save(transaction);

    // Call 3rd party service asynchronously
    this.triggerThirdParty(transaction);

    return transaction;
  }

  private async triggerThirdParty(transaction: Transaction) {
    const thirdPartyUrl = this.configService.get<string>('THIRD_PARTY_API_URL');
    const webhookUrl = this.configService.get<string>('WEBHOOK_URL');

    try {
      this.logger.log(`Calling 3rd party for transaction ${transaction.id}`);
      const response = await lastValueFrom(
        this.httpService.post(`${thirdPartyUrl}/transaction`, {
          id: transaction.id,
          webhookUrl,
        }),
      );

      // Successfully triggered
      this.logger.log(`3rd party request accepted for ${transaction.id}`);
      
      // Schedule a status check job in case webhook is missed (e.g., after 45 seconds)
      await this.statusQueue.add('check-status', { id: transaction.id }, { delay: 45000 });
      
    } catch (error) {
      this.logger.error(`Error calling 3rd party for transaction ${transaction.id}: ${error.message}`);
      
      // If it's a 504 timeout, the request might still go through
      if (error.response?.status === 504) {
        this.logger.warn(`3rd party timed out (504) for ${transaction.id}, will poll for status`);
        await this.statusQueue.add('check-status', { id: transaction.id }, { delay: 30000 });
      } else {
        // Other errors, mark as failed
        transaction.status = TransactionStatus.FAILED;
        await this.transactionsRepository.save(transaction);
        await this.notifyClient(transaction);
      }
    }
  }

  async handleWebhook(id: string, status: string) {
    this.logger.log(`Received webhook for transaction ${id} with status ${status}`);
    const transaction = await this.transactionsRepository.findOne({ where: { id } });

    if (!transaction) {
      this.logger.warn(`Received webhook for unknown transaction ${id}`);
      return;
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      this.logger.log(`Transaction ${id} already has status ${transaction.status}, ignoring webhook`);
      return;
    }

    transaction.status = status === 'completed' ? TransactionStatus.COMPLETED : TransactionStatus.DECLINED;
    await this.transactionsRepository.save(transaction);

    await this.notifyClient(transaction);
  }

  async checkStatus(id: string) {
    const transaction = await this.transactionsRepository.findOne({ where: { id } });
    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      return;
    }

    const thirdPartyUrl = this.configService.get<string>('THIRD_PARTY_API_URL');
    try {
      this.logger.log(`Polling status for transaction ${id}`);
      const response = await lastValueFrom(
        this.httpService.get(`${thirdPartyUrl}/transaction/${id}`),
      );

      if (response.data && response.data.status) {
        const newStatus = response.data.status === 'completed' ? TransactionStatus.COMPLETED : TransactionStatus.DECLINED;
        transaction.status = newStatus;
        await this.transactionsRepository.save(transaction);
        await this.notifyClient(transaction);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(`Transaction ${id} not found on 3rd party during poll`);
        // Maybe wait longer or mark as failed if it's been too long
      } else {
        this.logger.error(`Error polling status for ${id}: ${error.message}`);
      }
      
      // Re-schedule polling if still pending
      await this.statusQueue.add('check-status', { id: transaction.id }, { delay: 60000 });
    }
  }

  private async notifyClient(transaction: Transaction) {
    const clientUrl = this.configService.get<string>('CLIENT_API_URL');
    const status = transaction.status === TransactionStatus.COMPLETED ? 'accepted' : 'declined';

    try {
      this.logger.log(`Notifying client of status for ${transaction.id}: ${status}`);
      await lastValueFrom(
        this.httpService.put(`${clientUrl}/transaction`, {
          id: transaction.id,
          status,
        }),
      );
    } catch (error) {
      this.logger.error(`Error notifying client for transaction ${transaction.id}: ${error.message}`);
    }
  }

  findAll() {
    return this.transactionsRepository.find();
  }

  findOne(id: string) {
    return this.transactionsRepository.findOne({ where: { id } });
  }
}
