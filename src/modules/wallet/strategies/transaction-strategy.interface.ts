import { QueryRunner } from 'typeorm';
import { Transaction } from '../../../domain/entities/transaction.entity';
import { WalletEventPayload } from '../events/wallet-event.interface';

export interface TransactionContext {
  userId: string;
  amount?: number;
  recipientId?: string;
  transactionId?: string;
  description?: string;
}

export interface TransactionResult {
  transactions: Transaction[];
  events: WalletEventPayload[];
}

export interface TransactionStrategy {
  execute(
    context: TransactionContext,
    queryRunner: QueryRunner,
  ): Promise<TransactionResult>;
}
