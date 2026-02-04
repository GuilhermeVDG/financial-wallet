import { QueryRunner } from 'typeorm';
import { User } from '../../../domain/entities/user.entity';

export const USER_WALLET_REPOSITORY = Symbol('USER_WALLET_REPOSITORY');

export interface IUserWalletRepository {
  findByIdWithLock(
    userId: string,
    queryRunner: QueryRunner,
  ): Promise<User | null>;

  updateBalance(
    userId: string,
    newBalance: number,
    queryRunner: QueryRunner,
  ): Promise<void>;

  findById(userId: string): Promise<User | null>;
}
