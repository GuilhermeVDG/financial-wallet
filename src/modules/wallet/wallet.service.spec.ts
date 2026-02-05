import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from './repositories/transaction.repository.interface';
import {
  IUserWalletRepository,
  USER_WALLET_REPOSITORY,
} from './repositories/user-wallet.repository.interface';
import { WalletEventPublisher } from './events/wallet-event.publisher';
import { DepositStrategy } from './strategies/deposit.strategy';
import { TransferStrategy } from './strategies/transfer.strategy';
import { ReversalStrategy } from './strategies/reversal.strategy';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { Transaction } from '../../domain/entities/transaction.entity';
import { DataSource } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { TransactionQueryDto } from './dto/transaction-query.dto';

describe('WalletService', () => {
  let service: WalletService;
  let depositStrategy: DepositStrategy;
  let transferStrategy: TransferStrategy;
  let reversalStrategy: ReversalStrategy;
  let userWalletRepository: IUserWalletRepository;
  let transactionRepository: ITransactionRepository;
  let eventPublisher: WalletEventPublisher;
  let queryRunner: Record<string, jest.Mock>;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {},
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: TRANSACTION_REPOSITORY,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: USER_WALLET_REPOSITORY,
          useValue: {
            findById: jest.fn(),
          },
        },
        { provide: WalletEventPublisher, useValue: { publish: jest.fn() } },
        { provide: DepositStrategy, useValue: { execute: jest.fn() } },
        { provide: TransferStrategy, useValue: { execute: jest.fn() } },
        { provide: ReversalStrategy, useValue: { execute: jest.fn() } },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    depositStrategy = module.get<DepositStrategy>(DepositStrategy);
    transferStrategy = module.get<TransferStrategy>(TransferStrategy);
    reversalStrategy = module.get<ReversalStrategy>(ReversalStrategy);
    userWalletRepository = module.get<IUserWalletRepository>(
      USER_WALLET_REPOSITORY,
    );
    transactionRepository = module.get<ITransactionRepository>(
      TRANSACTION_REPOSITORY,
    );
    eventPublisher = module.get<WalletEventPublisher>(WalletEventPublisher);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deposit', () => {
    it('should execute a deposit and return the transaction', async () => {
      const userId = '1';
      const depositDto: DepositDto = { amount: 100, description: 'deposit' };
      const transaction = new Transaction();

      jest
        .spyOn(depositStrategy, 'execute')
        .mockResolvedValue({ transactions: [transaction], events: [] });

      await service.deposit(userId, depositDto);

      expect(depositStrategy.execute).toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    it('should execute a transfer and return the transaction', async () => {
      const fromUserId = '1';
      const transferDto: TransferDto = { recipientId: '2', amount: 50 };
      const transaction = new Transaction();

      jest
        .spyOn(transferStrategy, 'execute')
        .mockResolvedValue({ transactions: [transaction], events: [] });

      await service.transfer(fromUserId, transferDto);

      expect(transferStrategy.execute).toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('should return the user balance converted from cents', async () => {
      const userId = '1';
      const user = new User();
      user.balance = 10000;

      jest.spyOn(userWalletRepository, 'findById').mockResolvedValue(user);

      const result = await service.getBalance(userId);

      expect(userWalletRepository.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ balance: 100 });
    });

    it('should throw Error if user not found', async () => {
      jest.spyOn(userWalletRepository, 'findById').mockResolvedValue(null);

      await expect(service.getBalance('999')).rejects.toThrow('User not found');
    });
  });

  describe('reverse', () => {
    it('should execute a reversal and return the transaction', async () => {
      const userId = '1';
      const transactionId = 'tx-1';
      const transaction = new Transaction();
      transaction.amount = 5000;

      jest
        .spyOn(reversalStrategy, 'execute')
        .mockResolvedValue({ transactions: [transaction], events: [] });

      const result = await service.reverse(userId, transactionId);

      expect(reversalStrategy.execute).toHaveBeenCalled();
      expect(result.transaction.amount).toBe(50);
    });
  });

  describe('getTransactions', () => {
    it('should return a paginated list of transactions', async () => {
      const userId = '1';
      const query: TransactionQueryDto = { page: 1, limit: 10 };
      const transactions = [new Transaction()];
      const total = 1;

      jest
        .spyOn(transactionRepository, 'findByUserId')
        .mockResolvedValue({ data: transactions, total });

      const result = await service.getTransactions(userId, query);

      expect(transactionRepository.findByUserId).toHaveBeenCalledWith(
        userId,
        query,
      );
      expect(result.total).toEqual(total);
    });
  });

  describe('executeTransaction error handling', () => {
    it('should rollback transaction when strategy throws', async () => {
      const error = new Error('strategy failed');
      jest.spyOn(depositStrategy, 'execute').mockRejectedValue(error);

      await expect(service.deposit('1', { amount: 100 })).rejects.toThrow(
        'strategy failed',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('publishEvents error handling', () => {
    it('should catch event publish errors without throwing', async () => {
      const transaction = new Transaction();
      transaction.amount = 5000;

      jest.spyOn(depositStrategy, 'execute').mockResolvedValue({
        transactions: [transaction],
        events: [{ event: 'deposit.completed', data: {} } as any],
      });

      jest
        .spyOn(eventPublisher, 'publish')
        .mockRejectedValue(new Error('RabbitMQ down'));

      const result = await service.deposit('1', { amount: 100 });
      expect(result.transaction).toBeDefined();

      // Flush microtasks so the .catch() handler executes
      await new Promise((resolve) => process.nextTick(resolve));

      expect(eventPublisher.publish).toHaveBeenCalled();
    });
  });
});
