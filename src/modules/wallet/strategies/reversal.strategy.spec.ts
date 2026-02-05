import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { ReversalStrategy } from './reversal.strategy';
import { USER_WALLET_REPOSITORY } from '../repositories/user-wallet.repository.interface';
import { TRANSACTION_REPOSITORY } from '../repositories/transaction.repository.interface';
import { TransactionFactory } from '../factories/transaction.factory';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../../shared/enums/transaction-status.enum';
import { WalletEvent } from '../events/wallet-events.enum';
import { User } from '../../../domain/entities/user.entity';
import { Transaction } from '../../../domain/entities/transaction.entity';

describe('ReversalStrategy', () => {
  let strategy: ReversalStrategy;
  let userWalletRepository: Record<string, jest.Mock>;
  let transactionRepository: Record<string, jest.Mock>;
  let transactionFactory: Record<string, jest.Mock>;
  const queryRunner = {} as QueryRunner;

  beforeEach(async () => {
    userWalletRepository = {
      findByIdWithLock: jest.fn(),
      updateBalance: jest.fn(),
    };

    transactionRepository = {
      findByIdWithLock: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      findRelatedTransferTransaction: jest.fn(),
    };

    transactionFactory = {
      createReversal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReversalStrategy,
        { provide: USER_WALLET_REPOSITORY, useValue: userWalletRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: transactionRepository },
        { provide: TransactionFactory, useValue: transactionFactory },
      ],
    }).compile();

    strategy = module.get<ReversalStrategy>(ReversalStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  // ─── Validation ─────────────────────────────────────────────────────

  describe('validation', () => {
    it('should throw BadRequestException if transactionId is missing', async () => {
      await expect(
        strategy.execute({ userId: 'user-1' }, queryRunner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      transactionRepository.findByIdWithLock.mockResolvedValue(null);

      await expect(
        strategy.execute(
          { userId: 'user-1', transactionId: 'tx-1' },
          queryRunner,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if transaction already reversed', async () => {
      transactionRepository.findByIdWithLock.mockResolvedValue({
        id: 'tx-1',
        userId: 'user-1',
        status: TransactionStatus.REVERSED,
        type: TransactionType.DEPOSIT,
      });

      await expect(
        strategy.execute(
          { userId: 'user-1', transactionId: 'tx-1' },
          queryRunner,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if trying to reverse a reversal', async () => {
      transactionRepository.findByIdWithLock.mockResolvedValue({
        id: 'tx-1',
        userId: 'user-1',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.REVERSAL,
      });

      await expect(
        strategy.execute(
          { userId: 'user-1', transactionId: 'tx-1' },
          queryRunner,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if user does not own the transaction', async () => {
      transactionRepository.findByIdWithLock.mockResolvedValue({
        id: 'tx-1',
        userId: 'other-user',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.DEPOSIT,
      });

      await expect(
        strategy.execute(
          { userId: 'user-1', transactionId: 'tx-1' },
          queryRunner,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Deposit Reversal ───────────────────────────────────────────────

  describe('reverseDeposit', () => {
    it('should reverse a deposit successfully', async () => {
      const originalTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: 5000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.DEPOSIT,
        relatedUserId: null,
        relatedTransactionId: null,
      } as Transaction;

      const user = { id: 'user-1', balance: 15000 } as User;
      const reversalTx = { id: 'reversal-1' } as Transaction;

      transactionRepository.findByIdWithLock.mockResolvedValue(originalTx);
      userWalletRepository.findByIdWithLock.mockResolvedValue(user);
      transactionFactory.createReversal.mockReturnValue({});
      transactionRepository.create.mockResolvedValue(reversalTx);

      const result = await strategy.execute(
        { userId: 'user-1', transactionId: 'tx-1' },
        queryRunner,
      );

      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'user-1',
        10000,
        queryRunner,
      );
      expect(transactionRepository.updateStatus).toHaveBeenCalledWith(
        'tx-1',
        TransactionStatus.REVERSED,
        queryRunner,
      );
      expect(result.transactions).toEqual([reversalTx]);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].event).toBe(WalletEvent.REVERSAL_COMPLETED);
    });

    it('should throw NotFoundException if user not found during deposit reversal', async () => {
      const originalTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: 5000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.DEPOSIT,
        relatedUserId: null,
        relatedTransactionId: null,
      } as Transaction;

      transactionRepository.findByIdWithLock.mockResolvedValue(originalTx);
      userWalletRepository.findByIdWithLock.mockResolvedValue(null);

      await expect(
        strategy.execute(
          { userId: 'user-1', transactionId: 'tx-1' },
          queryRunner,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Transfer Reversal (Sender / Debit Side) ───────────────────────

  describe('reverseTransfer (sender side)', () => {
    it('should reverse a transfer from the sender (debit) side', async () => {
      const debitTx = {
        id: 'debit-1',
        userId: 'sender-1',
        amount: 10000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER,
        relatedUserId: 'receiver-1',
        relatedTransactionId: null, // debit side
      } as Transaction;

      const creditTx = {
        id: 'credit-1',
        userId: 'receiver-1',
        status: TransactionStatus.COMPLETED,
      } as Transaction;

      const senderUser = { id: 'sender-1', balance: 5000 } as User;
      const receiverUser = { id: 'receiver-1', balance: 25000 } as User;

      // First call: find original tx (debit)
      transactionRepository.findByIdWithLock.mockResolvedValue(debitTx);
      transactionRepository.findRelatedTransferTransaction.mockResolvedValue(
        creditTx,
      );

      // Lock users: receiver-1 < sender-1 → receiver first
      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(receiverUser)
        .mockResolvedValueOnce(senderUser);

      const senderReversal = { id: 'rev-sender' } as Transaction;
      const receiverReversal = { id: 'rev-receiver' } as Transaction;

      transactionFactory.createReversal.mockReturnValue({});
      transactionRepository.create
        .mockResolvedValueOnce(senderReversal)
        .mockResolvedValueOnce(receiverReversal);

      const result = await strategy.execute(
        { userId: 'sender-1', transactionId: 'debit-1' },
        queryRunner,
      );

      // Sender gets money back
      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'sender-1',
        15000,
        queryRunner,
      );
      // Receiver loses money
      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'receiver-1',
        15000,
        queryRunner,
      );

      // Both original transactions marked as reversed
      expect(transactionRepository.updateStatus).toHaveBeenCalledWith(
        'debit-1',
        TransactionStatus.REVERSED,
        queryRunner,
      );
      expect(transactionRepository.updateStatus).toHaveBeenCalledWith(
        'credit-1',
        TransactionStatus.REVERSED,
        queryRunner,
      );

      expect(result.transactions).toEqual([senderReversal, receiverReversal]);
      expect(result.events[0].event).toBe(WalletEvent.REVERSAL_COMPLETED);
    });
  });

  // ─── Transfer Reversal (Receiver / Credit Side) ─────────────────────

  describe('reverseTransfer (receiver side)', () => {
    it('should reverse a transfer from the receiver (credit) side', async () => {
      const creditTx = {
        id: 'credit-1',
        userId: 'receiver-1',
        amount: 10000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER,
        relatedUserId: 'sender-1',
        relatedTransactionId: 'debit-1', // non-null = credit side
      } as Transaction;

      const debitTx = {
        id: 'debit-1',
        userId: 'sender-1',
        amount: 10000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER,
        relatedUserId: 'receiver-1',
        relatedTransactionId: null,
      } as Transaction;

      const senderUser = { id: 'sender-1', balance: 5000 } as User;
      const receiverUser = { id: 'receiver-1', balance: 25000 } as User;

      // First call: find original tx (credit)
      // Second call (inside reverseTransfer): find debit by relatedTransactionId
      transactionRepository.findByIdWithLock
        .mockResolvedValueOnce(creditTx)
        .mockResolvedValueOnce(debitTx);

      // Lock users: receiver-1 < sender-1 → receiver first
      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(receiverUser)
        .mockResolvedValueOnce(senderUser);

      const senderReversal = { id: 'rev-sender' } as Transaction;
      const receiverReversal = { id: 'rev-receiver' } as Transaction;

      transactionFactory.createReversal.mockReturnValue({});
      transactionRepository.create
        .mockResolvedValueOnce(senderReversal)
        .mockResolvedValueOnce(receiverReversal);

      const result = await strategy.execute(
        { userId: 'receiver-1', transactionId: 'credit-1' },
        queryRunner,
      );

      // Sender gets money back (not the receiver!)
      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'sender-1',
        15000,
        queryRunner,
      );
      // Receiver gives money back
      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'receiver-1',
        15000,
        queryRunner,
      );

      expect(result.transactions).toEqual([senderReversal, receiverReversal]);
    });

    it('should throw NotFoundException if debit transaction not found', async () => {
      const creditTx = {
        id: 'credit-1',
        userId: 'receiver-1',
        amount: 10000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER,
        relatedUserId: 'sender-1',
        relatedTransactionId: 'debit-1',
      } as Transaction;

      transactionRepository.findByIdWithLock
        .mockResolvedValueOnce(creditTx)
        .mockResolvedValueOnce(null); // debit not found

      await expect(
        strategy.execute(
          { userId: 'receiver-1', transactionId: 'credit-1' },
          queryRunner,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if debit side already reversed', async () => {
      const creditTx = {
        id: 'credit-1',
        userId: 'receiver-1',
        amount: 10000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER,
        relatedUserId: 'sender-1',
        relatedTransactionId: 'debit-1',
      } as Transaction;

      const debitTx = {
        id: 'debit-1',
        userId: 'sender-1',
        status: TransactionStatus.REVERSED,
      } as Transaction;

      transactionRepository.findByIdWithLock
        .mockResolvedValueOnce(creditTx)
        .mockResolvedValueOnce(debitTx);

      await expect(
        strategy.execute(
          { userId: 'receiver-1', transactionId: 'credit-1' },
          queryRunner,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if transfer has no relatedUserId', async () => {
      const transferTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: 10000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER,
        relatedUserId: null,
        relatedTransactionId: null,
      } as Transaction;

      transactionRepository.findByIdWithLock.mockResolvedValue(transferTx);

      await expect(
        strategy.execute(
          { userId: 'user-1', transactionId: 'tx-1' },
          queryRunner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if one of the users not found', async () => {
      const debitTx = {
        id: 'debit-1',
        userId: 'sender-1',
        amount: 10000,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER,
        relatedUserId: 'receiver-1',
        relatedTransactionId: null,
      } as Transaction;

      transactionRepository.findByIdWithLock.mockResolvedValue(debitTx);
      transactionRepository.findRelatedTransferTransaction.mockResolvedValue(
        null,
      );

      // receiver-1 < sender-1 → receiver first = null
      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'sender-1', balance: 5000 });

      await expect(
        strategy.execute(
          { userId: 'sender-1', transactionId: 'debit-1' },
          queryRunner,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
