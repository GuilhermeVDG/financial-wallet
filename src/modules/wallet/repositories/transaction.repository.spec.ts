import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TransactionRepository } from './transaction.repository';
import { Transaction } from '../../../domain/entities/transaction.entity';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../../shared/enums/transaction-status.enum';

describe('TransactionRepository', () => {
  let repository: TransactionRepository;
  let txRepo: Record<string, jest.Mock>;
  let queryRunner: { manager: Record<string, jest.Mock> };

  beforeEach(async () => {
    txRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    queryRunner = {
      manager: {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionRepository,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
      ],
    }).compile();

    repository = module.get<TransactionRepository>(TransactionRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a transaction via queryRunner', async () => {
      const data = { userId: 'user-1', amount: 5000 };
      const created = { ...data } as Transaction;
      const saved = { id: 'tx-1', ...data } as unknown as Transaction;

      queryRunner.manager.create.mockReturnValue(created);
      queryRunner.manager.save.mockResolvedValue(saved);

      const result = await repository.create(data, queryRunner as any);

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        Transaction,
        data,
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        Transaction,
        created,
      );
      expect(result).toBe(saved);
    });
  });

  describe('findById', () => {
    it('should find a transaction by id', async () => {
      const tx = { id: 'tx-1' } as Transaction;
      txRepo.findOne.mockResolvedValue(tx);

      const result = await repository.findById('tx-1');

      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
      expect(result).toBe(tx);
    });

    it('should return null when not found', async () => {
      txRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithLock', () => {
    it('should find with pessimistic lock via queryRunner', async () => {
      const tx = { id: 'tx-1' } as Transaction;
      queryRunner.manager.findOne.mockResolvedValue(tx);

      const result = await repository.findByIdWithLock(
        'tx-1',
        queryRunner as any,
      );

      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: 'tx-1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(result).toBe(tx);
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status via queryRunner', async () => {
      queryRunner.manager.update.mockResolvedValue(undefined);

      await repository.updateStatus(
        'tx-1',
        TransactionStatus.REVERSED,
        queryRunner as any,
      );

      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        Transaction,
        'tx-1',
        { status: TransactionStatus.REVERSED },
      );
    });
  });

  describe('findByUserId', () => {
    it('should return paginated transactions without type filter', async () => {
      const transactions = [{ id: 'tx-1' }] as Transaction[];
      txRepo.findAndCount.mockResolvedValue([transactions, 1]);

      const result = await repository.findByUserId('user-1', {
        page: 1,
        limit: 20,
      });

      expect(txRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: transactions, total: 1 });
    });

    it('should add type filter when provided', async () => {
      txRepo.findAndCount.mockResolvedValue([[], 0]);

      await repository.findByUserId('user-1', {
        page: 2,
        limit: 10,
        type: TransactionType.DEPOSIT,
      });

      expect(txRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1', type: TransactionType.DEPOSIT },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('should calculate skip correctly for page 3', async () => {
      txRepo.findAndCount.mockResolvedValue([[], 0]);

      await repository.findByUserId('user-1', { page: 3, limit: 5 });

      expect(txRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  describe('findRelatedTransferTransaction', () => {
    it('should find related transaction with lock via queryRunner', async () => {
      const tx = { id: 'credit-1' } as Transaction;
      queryRunner.manager.findOne.mockResolvedValue(tx);

      const result = await repository.findRelatedTransferTransaction(
        'debit-1',
        queryRunner as any,
      );

      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { relatedTransactionId: 'debit-1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(result).toBe(tx);
    });
  });
});
