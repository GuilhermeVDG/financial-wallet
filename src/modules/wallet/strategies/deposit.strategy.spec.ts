import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DepositStrategy } from './deposit.strategy';
import { USER_WALLET_REPOSITORY } from '../repositories/user-wallet.repository.interface';
import { TRANSACTION_REPOSITORY } from '../repositories/transaction.repository.interface';
import { TransactionFactory } from '../factories/transaction.factory';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../../shared/enums/transaction-status.enum';
import { WalletEvent } from '../events/wallet-events.enum';
import { User } from '../../../domain/entities/user.entity';
import { Transaction } from '../../../domain/entities/transaction.entity';

describe('DepositStrategy', () => {
  let strategy: DepositStrategy;
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
      create: jest.fn(),
    };

    transactionFactory = {
      createDeposit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositStrategy,
        { provide: USER_WALLET_REPOSITORY, useValue: userWalletRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: transactionRepository },
        { provide: TransactionFactory, useValue: transactionFactory },
      ],
    }).compile();

    strategy = module.get<DepositStrategy>(DepositStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('execute', () => {
    it('should deposit successfully and update balance', async () => {
      const user = { id: 'user-1', balance: 10000 } as User;
      const txData = {
        userId: 'user-1',
        type: TransactionType.DEPOSIT,
        amount: 5000,
        status: TransactionStatus.COMPLETED,
      };
      const savedTx = { id: 'tx-1', ...txData } as unknown as Transaction;

      userWalletRepository.findByIdWithLock.mockResolvedValue(user);
      transactionFactory.createDeposit.mockReturnValue(txData);
      transactionRepository.create.mockResolvedValue(savedTx);

      const result = await strategy.execute(
        { userId: 'user-1', amount: 5000, description: 'Test' },
        queryRunner,
      );

      expect(userWalletRepository.findByIdWithLock).toHaveBeenCalledWith(
        'user-1',
        queryRunner,
      );
      expect(userWalletRepository.updateBalance).toHaveBeenCalledWith(
        'user-1',
        15000,
        queryRunner,
      );
      expect(transactionFactory.createDeposit).toHaveBeenCalledWith({
        userId: 'user-1',
        amount: 5000,
        description: 'Test',
      });
      expect(result.transactions).toEqual([savedTx]);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].event).toBe(WalletEvent.DEPOSIT_COMPLETED);
      expect(result.events[0].data).toMatchObject({
        transactionId: 'tx-1',
        userId: 'user-1',
        amount: 5000,
        newBalance: 15000,
      });
    });

    it('should throw BadRequestException if amount is zero', async () => {
      await expect(
        strategy.execute({ userId: 'user-1', amount: 0 }, queryRunner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if amount is negative', async () => {
      await expect(
        strategy.execute({ userId: 'user-1', amount: -100 }, queryRunner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if amount is undefined', async () => {
      await expect(
        strategy.execute({ userId: 'user-1' }, queryRunner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      userWalletRepository.findByIdWithLock.mockResolvedValue(null);

      await expect(
        strategy.execute({ userId: 'user-1', amount: 5000 }, queryRunner),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user balance is negative', async () => {
      const user = { id: 'user-1', balance: -100 } as User;
      userWalletRepository.findByIdWithLock.mockResolvedValue(user);

      await expect(
        strategy.execute({ userId: 'user-1', amount: 5000 }, queryRunner),
      ).rejects.toThrow(ConflictException);
    });
  });
});
