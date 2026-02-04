import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { Transaction } from '../../../domain/entities/transaction.entity';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../../shared/enums/transaction-status.enum';
import { ITransactionRepository } from './transaction.repository.interface';

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async create(
    data: Partial<Transaction>,
    queryRunner: QueryRunner,
  ): Promise<Transaction> {
    const transaction = queryRunner.manager.create(Transaction, data);
    return queryRunner.manager.save(Transaction, transaction);
  }

  async findById(transactionId: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { id: transactionId },
    });
  }

  async findByIdWithLock(
    transactionId: string,
    queryRunner: QueryRunner,
  ): Promise<Transaction | null> {
    return queryRunner.manager.findOne(Transaction, {
      where: { id: transactionId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async updateStatus(
    transactionId: string,
    status: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.manager.update(Transaction, transactionId, {
      status: status as TransactionStatus,
    });
  }

  async findByUserId(
    userId: string,
    options: { page: number; limit: number; type?: TransactionType },
  ): Promise<{ data: Transaction[]; total: number }> {
    const { page, limit, type } = options;

    const where: Record<string, unknown> = { userId };
    if (type) {
      where.type = type;
    }

    const [data, total] = await this.transactionRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async findRelatedTransferTransaction(
    relatedTransactionId: string,
    queryRunner: QueryRunner,
  ): Promise<Transaction | null> {
    return queryRunner.manager.findOne(Transaction, {
      where: { relatedTransactionId },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
