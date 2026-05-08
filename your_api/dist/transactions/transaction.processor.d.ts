import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TransactionsService } from './transactions.service';
export declare class TransactionProcessor extends WorkerHost {
    private readonly transactionsService;
    private readonly logger;
    constructor(transactionsService: TransactionsService);
    process(job: Job<any, any, string>): Promise<any>;
}
