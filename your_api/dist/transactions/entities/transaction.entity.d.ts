export declare enum TransactionStatus {
    PENDING = "pending",
    COMPLETED = "completed",
    DECLINED = "declined",
    FAILED = "failed"
}
export declare class Transaction {
    id: string;
    status: TransactionStatus;
    thirdPartyId: string;
    createdAt: Date;
    updatedAt: Date;
}
