import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
export declare class TransactionsService {
    private transactionsRepository;
    private readonly httpService;
    private readonly configService;
    private statusQueue;
    private readonly logger;
    constructor(transactionsRepository: Repository<Transaction>, httpService: HttpService, configService: ConfigService, statusQueue: Queue);
    create(createTransactionDto: CreateTransactionDto): Promise<Transaction>;
    private triggerThirdParty;
    handleWebhook(id: string, status: string): Promise<void>;
    checkStatus(id: string): Promise<void>;
    private notifyClient;
    findAll(): Promise<Transaction[]>;
    findOne(id: string): Promise<Transaction | null>;
}
