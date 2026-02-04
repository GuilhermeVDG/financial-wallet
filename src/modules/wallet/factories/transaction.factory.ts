import { Injectable } from '@nestjs/common';
import { Transaction } from '../../../domain/entities/transaction.entity';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../../shared/enums/transaction-status.enum';

@Injectable()
export class TransactionFactory {
  createDeposit(params: {
    userId: string;
    amount: number;
    description?: string;
  }): Partial<Transaction> {
    return {
      userId: params.userId,
      type: TransactionType.DEPOSIT,
      amount: params.amount,
      status: TransactionStatus.COMPLETED,
      description: params.description || 'Deposit',
    };
  }

  createTransferDebit(params: {
    senderId: string;
    recipientId: string;
    amount: number;
    description?: string;
  }): Partial<Transaction> {
    return {
      userId: params.senderId,
      type: TransactionType.TRANSFER,
      amount: params.amount,
      relatedUserId: params.recipientId,
      status: TransactionStatus.COMPLETED,
      description: params.description || 'Transfer sent',
    };
  }

  createTransferCredit(params: {
    senderId: string;
    recipientId: string;
    amount: number;
    relatedTransactionId: string;
    description?: string;
  }): Partial<Transaction> {
    return {
      userId: params.recipientId,
      type: TransactionType.TRANSFER,
      amount: params.amount,
      relatedUserId: params.senderId,
      relatedTransactionId: params.relatedTransactionId,
      status: TransactionStatus.COMPLETED,
      description: params.description || 'Transfer received',
    };
  }

  createReversal(params: {
    userId: string;
    amount: number;
    originalTransactionId: string;
    relatedUserId?: string;
    description?: string;
  }): Partial<Transaction> {
    return {
      userId: params.userId,
      type: TransactionType.REVERSAL,
      amount: params.amount,
      relatedTransactionId: params.originalTransactionId,
      relatedUserId: params.relatedUserId || null,
      status: TransactionStatus.COMPLETED,
      description: params.description || 'Transaction reversal',
    };
  }
}
