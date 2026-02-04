import { QueryRunner } from 'typeorm';
import { Transaction } from '../../../domain/entities/transaction.entity';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface ITransactionRepository {
  create(
    data: Partial<Transaction>,
    queryRunner: QueryRunner,
  ): Promise<Transaction>;

  findById(transactionId: string): Promise<Transaction | null>;

  findByIdWithLock(
    transactionId: string,
    queryRunner: QueryRunner,
  ): Promise<Transaction | null>;

  updateStatus(
    transactionId: string,
    status: string,
    queryRunner: QueryRunner,
  ): Promise<void>;

  findByUserId(
    userId: string,
    options: {
      page: number;
      limit: number;
      type?: TransactionType;
    },
  ): Promise<{ data: Transaction[]; total: number }>;

  findRelatedTransferTransaction(
    relatedTransactionId: string,
    queryRunner: QueryRunner,
  ): Promise<Transaction | null>;
}
