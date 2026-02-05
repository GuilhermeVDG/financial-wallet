import { TransactionFactory } from './transaction.factory';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../../shared/enums/transaction-status.enum';

describe('TransactionFactory', () => {
  let factory: TransactionFactory;

  beforeEach(() => {
    factory = new TransactionFactory();
  });

  describe('createDeposit', () => {
    it('should create a deposit transaction with description', () => {
      const result = factory.createDeposit({
        userId: 'user-1',
        amount: 5000,
        description: 'Salary',
      });

      expect(result).toEqual({
        userId: 'user-1',
        type: TransactionType.DEPOSIT,
        amount: 5000,
        status: TransactionStatus.COMPLETED,
        description: 'Salary',
      });
    });

    it('should use default description when not provided', () => {
      const result = factory.createDeposit({
        userId: 'user-1',
        amount: 5000,
      });

      expect(result.description).toBe('Deposit');
    });
  });

  describe('createTransferDebit', () => {
    it('should create a transfer debit transaction', () => {
      const result = factory.createTransferDebit({
        senderId: 'sender-1',
        recipientId: 'recipient-1',
        amount: 3000,
        description: 'Payment',
      });

      expect(result).toEqual({
        userId: 'sender-1',
        type: TransactionType.TRANSFER,
        amount: 3000,
        relatedUserId: 'recipient-1',
        status: TransactionStatus.COMPLETED,
        description: 'Payment',
      });
    });

    it('should use default description when not provided', () => {
      const result = factory.createTransferDebit({
        senderId: 'sender-1',
        recipientId: 'recipient-1',
        amount: 3000,
      });

      expect(result.description).toBe('Transfer sent');
    });
  });

  describe('createTransferCredit', () => {
    it('should create a transfer credit transaction linked to debit', () => {
      const result = factory.createTransferCredit({
        senderId: 'sender-1',
        recipientId: 'recipient-1',
        amount: 3000,
        relatedTransactionId: 'debit-tx-1',
        description: 'Payment received',
      });

      expect(result).toEqual({
        userId: 'recipient-1',
        type: TransactionType.TRANSFER,
        amount: 3000,
        relatedUserId: 'sender-1',
        relatedTransactionId: 'debit-tx-1',
        status: TransactionStatus.COMPLETED,
        description: 'Payment received',
      });
    });

    it('should use default description when not provided', () => {
      const result = factory.createTransferCredit({
        senderId: 'sender-1',
        recipientId: 'recipient-1',
        amount: 3000,
        relatedTransactionId: 'debit-tx-1',
      });

      expect(result.description).toBe('Transfer received');
    });
  });

  describe('createReversal', () => {
    it('should create a reversal transaction with relatedUserId', () => {
      const result = factory.createReversal({
        userId: 'user-1',
        amount: 5000,
        originalTransactionId: 'orig-tx-1',
        relatedUserId: 'other-user',
        description: 'Reversal of transfer',
      });

      expect(result).toEqual({
        userId: 'user-1',
        type: TransactionType.REVERSAL,
        amount: 5000,
        relatedTransactionId: 'orig-tx-1',
        relatedUserId: 'other-user',
        status: TransactionStatus.COMPLETED,
        description: 'Reversal of transfer',
      });
    });

    it('should set relatedUserId to null when not provided', () => {
      const result = factory.createReversal({
        userId: 'user-1',
        amount: 5000,
        originalTransactionId: 'orig-tx-1',
      });

      expect(result.relatedUserId).toBeNull();
      expect(result.description).toBe('Transaction reversal');
    });
  });
});
