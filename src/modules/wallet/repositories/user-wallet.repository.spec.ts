import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserWalletRepository } from './user-wallet.repository';
import { User } from '../../../domain/entities/user.entity';

describe('UserWalletRepository', () => {
  let repository: UserWalletRepository;
  let userRepo: Record<string, jest.Mock>;
  let queryRunner: { manager: Record<string, jest.Mock> };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
    };

    queryRunner = {
      manager: {
        findOne: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserWalletRepository,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    repository = module.get<UserWalletRepository>(UserWalletRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByIdWithLock', () => {
    it('should call queryRunner.manager.findOne with pessimistic lock', async () => {
      const user = { id: 'user-1', balance: 10000 } as User;
      queryRunner.manager.findOne.mockResolvedValue(user);

      const result = await repository.findByIdWithLock(
        'user-1',
        queryRunner as any,
      );

      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(User, {
        where: { id: 'user-1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(result).toBe(user);
    });

    it('should return null when user not found', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      const result = await repository.findByIdWithLock(
        'missing',
        queryRunner as any,
      );

      expect(result).toBeNull();
    });
  });

  describe('updateBalance', () => {
    it('should call queryRunner.manager.update with new balance', async () => {
      queryRunner.manager.update.mockResolvedValue(undefined);

      await repository.updateBalance('user-1', 20000, queryRunner as any);

      expect(queryRunner.manager.update).toHaveBeenCalledWith(User, 'user-1', {
        balance: 20000,
      });
    });
  });

  describe('findById', () => {
    it('should call the injected repository findOne', async () => {
      const user = { id: 'user-1' } as User;
      userRepo.findOne.mockResolvedValue(user);

      const result = await repository.findById('user-1');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toBe(user);
    });

    it('should return null when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });
});
