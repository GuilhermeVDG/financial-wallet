import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { TransferStrategy } from './transfer.strategy';
import { USER_WALLET_REPOSITORY } from '../repositories/user-wallet.repository.interface';
import { TRANSACTION_REPOSITORY } from '../repositories/transaction.repository.interface';
import { TransactionFactory } from '../factories/transaction.factory';
import { WalletEvent } from '../events/wallet-events.enum';
import { User } from '../../../domain/entities/user.entity';
import { Transaction } from '../../../domain/entities/transaction.entity';

describe('TransferStrategy', () => {
  let strategy: TransferStrategy;
  let userWalletRepository: Record<string, jest.Mock>;
  let transactionRepository: Record<string, jest.Mock>;
  let transactionFactory: Record<string, jest.Mock>;
  const queryRunner = {} as QueryRunner;

  const sender = { id: 'sender-1', balance: 50000 } as User;
  const recipient = { id: 'recipient-1', balance: 10000 } as User;

  beforeEach(async () => {
    userWalletRepository = {
      findByIdWithLock: jest.fn(),
      updateBalance: jest.fn(),
    };

    transactionRepository = {
      create: jest.fn(),
    };

    transactionFactory = {
      createTransferDebit: jest.fn(),
      createTransferCredit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferStrategy,
        { provide: USER_WALLET_REPOSITORY, useValue: userWalletRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: transactionRepository },
        { provide: TransactionFactory, useValue: transactionFactory },
      ],
    }).compile();

    strategy = module.get<TransferStrategy>(TransferStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('execute', () => {
    it('should transfer successfully and create debit+credit transactions', async () => {
      // sender ID < recipient ID → sender locked first
      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(recipient) // recipient-1 < sender-1
        .mockResolvedValueOnce(sender);

      const debitTx = { id: 'debit-1' } as Transaction;
      const creditTx = { id: 'credit-1' } as Transaction;

      transactionFactory.createTransferDebit.mockReturnValue({});
      transactionFactory.createTransferCredit.mockReturnValue({});
      transactionRepository.create
        .mockResolvedValueOnce(debitTx)
        .mockResolvedValueOnce(creditTx);

      const result = await strategy.execute(
        {
          userId: 'sender-1',
          recipientId: 'recipient-1',
          amount: 20000,
          description: 'Payment',
        },
        queryRunner,
      );

      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'sender-1',
        30000,
        queryRunner,
      );
      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'recipient-1',
        30000,
        queryRunner,
      );
      expect(result.transactions).toEqual([debitTx, creditTx]);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].event).toBe(WalletEvent.TRANSFER_COMPLETED);
    });

    it('should lock users in deterministic order (sender < recipient)', async () => {
      const senderA = { id: 'sender-a', balance: 50000 } as User;
      const recipientZ = { id: 'sender-z', balance: 10000 } as User;

      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(senderA)
        .mockResolvedValueOnce(recipientZ);

      transactionFactory.createTransferDebit.mockReturnValue({});
      transactionFactory.createTransferCredit.mockReturnValue({});
      transactionRepository.create.mockResolvedValue({
        id: 'tx',
      } as Transaction);

      await strategy.execute(
        { userId: 'sender-a', recipientId: 'sender-z', amount: 1000 },
        queryRunner,
      );

      expect(userWalletRepository.findByIdWithLock).toHaveBeenNthCalledWith(
        1,
        'sender-a',
        queryRunner,
      );
      expect(userWalletRepository.findByIdWithLock).toHaveBeenNthCalledWith(
        2,
        'sender-z',
        queryRunner,
      );
    });

    it('should throw BadRequestException if amount is zero', async () => {
      await expect(
        strategy.execute(
          { userId: 'sender-1', recipientId: 'recipient-1', amount: 0 },
          queryRunner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if amount is undefined', async () => {
      await expect(
        strategy.execute(
          { userId: 'sender-1', recipientId: 'recipient-1' },
          queryRunner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if recipientId is missing', async () => {
      await expect(
        strategy.execute({ userId: 'sender-1', amount: 1000 }, queryRunner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for self-transfer', async () => {
      await expect(
        strategy.execute(
          { userId: 'user-1', recipientId: 'user-1', amount: 1000 },
          queryRunner,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if sender not found', async () => {
      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(recipient)
        .mockResolvedValueOnce(null);

      await expect(
        strategy.execute(
          { userId: 'sender-1', recipientId: 'recipient-1', amount: 1000 },
          queryRunner,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if recipient not found', async () => {
      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sender);

      await expect(
        strategy.execute(
          { userId: 'sender-1', recipientId: 'recipient-1', amount: 1000 },
          queryRunner,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if sender has insufficient balance', async () => {
      const poorSender = { id: 'sender-1', balance: 500 } as User;

      userWalletRepository.findByIdWithLock
        .mockResolvedValueOnce(recipient)
        .mockResolvedValueOnce(poorSender);

      await expect(
        strategy.execute(
          { userId: 'sender-1', recipientId: 'recipient-1', amount: 1000 },
          queryRunner,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
