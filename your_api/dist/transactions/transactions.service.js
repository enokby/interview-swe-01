"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TransactionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const rxjs_1 = require("rxjs");
const transaction_entity_1 = require("./entities/transaction.entity");
let TransactionsService = TransactionsService_1 = class TransactionsService {
    transactionsRepository;
    httpService;
    configService;
    statusQueue;
    logger = new common_1.Logger(TransactionsService_1.name);
    constructor(transactionsRepository, httpService, configService, statusQueue) {
        this.transactionsRepository = transactionsRepository;
        this.httpService = httpService;
        this.configService = configService;
        this.statusQueue = statusQueue;
    }
    async create(createTransactionDto) {
        const { id } = createTransactionDto;
        let transaction = await this.transactionsRepository.findOne({ where: { id } });
        if (transaction) {
            this.logger.log(`Transaction ${id} already exists with status ${transaction.status}`);
            return transaction;
        }
        transaction = this.transactionsRepository.create({
            id,
            status: transaction_entity_1.TransactionStatus.PENDING,
        });
        await this.transactionsRepository.save(transaction);
        this.triggerThirdParty(transaction);
        return transaction;
    }
    async triggerThirdParty(transaction) {
        const thirdPartyUrl = this.configService.get('THIRD_PARTY_API_URL');
        const webhookUrl = this.configService.get('WEBHOOK_URL');
        try {
            this.logger.log(`Calling 3rd party for transaction ${transaction.id}`);
            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.post(`${thirdPartyUrl}/transaction`, {
                id: transaction.id,
                webhookUrl,
            }));
            this.logger.log(`3rd party request accepted for ${transaction.id}`);
            await this.statusQueue.add('check-status', { id: transaction.id }, { delay: 45000 });
        }
        catch (error) {
            this.logger.error(`Error calling 3rd party for transaction ${transaction.id}: ${error.message}`);
            if (error.response?.status === 504) {
                this.logger.warn(`3rd party timed out (504) for ${transaction.id}, will poll for status`);
                await this.statusQueue.add('check-status', { id: transaction.id }, { delay: 30000 });
            }
            else {
                transaction.status = transaction_entity_1.TransactionStatus.FAILED;
                await this.transactionsRepository.save(transaction);
                await this.notifyClient(transaction);
            }
        }
    }
    async handleWebhook(id, status) {
        this.logger.log(`Received webhook for transaction ${id} with status ${status}`);
        const transaction = await this.transactionsRepository.findOne({ where: { id } });
        if (!transaction) {
            this.logger.warn(`Received webhook for unknown transaction ${id}`);
            return;
        }
        if (transaction.status !== transaction_entity_1.TransactionStatus.PENDING) {
            this.logger.log(`Transaction ${id} already has status ${transaction.status}, ignoring webhook`);
            return;
        }
        transaction.status = status === 'completed' ? transaction_entity_1.TransactionStatus.COMPLETED : transaction_entity_1.TransactionStatus.DECLINED;
        await this.transactionsRepository.save(transaction);
        await this.notifyClient(transaction);
    }
    async checkStatus(id) {
        const transaction = await this.transactionsRepository.findOne({ where: { id } });
        if (!transaction || transaction.status !== transaction_entity_1.TransactionStatus.PENDING) {
            return;
        }
        const thirdPartyUrl = this.configService.get('THIRD_PARTY_API_URL');
        try {
            this.logger.log(`Polling status for transaction ${id}`);
            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${thirdPartyUrl}/transaction/${id}`));
            if (response.data && response.data.status) {
                const newStatus = response.data.status === 'completed' ? transaction_entity_1.TransactionStatus.COMPLETED : transaction_entity_1.TransactionStatus.DECLINED;
                transaction.status = newStatus;
                await this.transactionsRepository.save(transaction);
                await this.notifyClient(transaction);
            }
        }
        catch (error) {
            if (error.response?.status === 404) {
                this.logger.warn(`Transaction ${id} not found on 3rd party during poll`);
            }
            else {
                this.logger.error(`Error polling status for ${id}: ${error.message}`);
            }
            await this.statusQueue.add('check-status', { id: transaction.id }, { delay: 60000 });
        }
    }
    async notifyClient(transaction) {
        const clientUrl = this.configService.get('CLIENT_API_URL');
        const status = transaction.status === transaction_entity_1.TransactionStatus.COMPLETED ? 'accepted' : 'declined';
        try {
            this.logger.log(`Notifying client of status for ${transaction.id}: ${status}`);
            await (0, rxjs_1.lastValueFrom)(this.httpService.put(`${clientUrl}/transaction`, {
                id: transaction.id,
                status,
            }));
        }
        catch (error) {
            this.logger.error(`Error notifying client for transaction ${transaction.id}: ${error.message}`);
        }
    }
    findAll() {
        return this.transactionsRepository.find();
    }
    findOne(id) {
        return this.transactionsRepository.findOne({ where: { id } });
    }
};
exports.TransactionsService = TransactionsService;
exports.TransactionsService = TransactionsService = TransactionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(3, (0, bullmq_1.InjectQueue)('transaction-status')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        axios_1.HttpService,
        config_1.ConfigService,
        bullmq_2.Queue])
], TransactionsService);
//# sourceMappingURL=transactions.service.js.map