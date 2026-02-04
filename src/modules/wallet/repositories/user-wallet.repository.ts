import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { User } from '../../../domain/entities/user.entity';
import { IUserWalletRepository } from './user-wallet.repository.interface';

@Injectable()
export class UserWalletRepository implements IUserWalletRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByIdWithLock(
    userId: string,
    queryRunner: QueryRunner,
  ): Promise<User | null> {
    return queryRunner.manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async updateBalance(
    userId: string,
    newBalance: number,
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.manager.update(User, userId, { balance: newBalance });
  }

  async findById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }
}
