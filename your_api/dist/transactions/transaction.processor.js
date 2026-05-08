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
var TransactionProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const transactions_service_1 = require("./transactions.service");
const common_1 = require("@nestjs/common");
let TransactionProcessor = TransactionProcessor_1 = class TransactionProcessor extends bullmq_1.WorkerHost {
    transactionsService;
    logger = new common_1.Logger(TransactionProcessor_1.name);
    constructor(transactionsService) {
        super();
        this.transactionsService = transactionsService;
    }
    async process(job) {
        switch (job.name) {
            case 'check-status':
                this.logger.log(`Processing check-status job for transaction ${job.data.id}`);
                await this.transactionsService.checkStatus(job.data.id);
                break;
            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
        }
    }
};
exports.TransactionProcessor = TransactionProcessor;
exports.TransactionProcessor = TransactionProcessor = TransactionProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('transaction-status'),
    __metadata("design:paramtypes", [transactions_service_1.TransactionsService])
], TransactionProcessor);
//# sourceMappingURL=transaction.processor.js.map