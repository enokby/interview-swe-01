import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TransactionsService } from './transactions.service';
import { Logger } from '@nestjs/common';

@Processor('transaction-status')
export class TransactionProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(private readonly transactionsService: TransactionsService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'check-status':
        this.logger.log(`Processing check-status job for transaction ${job.data.id}`);
        await this.transactionsService.checkStatus(job.data.id);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
