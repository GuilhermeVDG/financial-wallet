import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  TransactionContext,
  TransactionStrategy,
} from './strategies/transaction-strategy.interface';
import { DepositStrategy } from './strategies/deposit.strategy';
import { TransferStrategy } from './strategies/transfer.strategy';
import { ReversalStrategy } from './strategies/reversal.strategy';
import {
  IUserWalletRepository,
  USER_WALLET_REPOSITORY,
} from './repositories/user-wallet.repository.interface';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from './repositories/transaction.repository.interface';
import { WalletEventPublisher } from './events/wallet-event.publisher';
import { WalletEventPayload } from './events/wallet-event.interface';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { Transaction } from '../../domain/entities/transaction.entity';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly depositStrategy: DepositStrategy,
    private readonly transferStrategy: TransferStrategy,
    private readonly reversalStrategy: ReversalStrategy,
    @Inject(USER_WALLET_REPOSITORY)
    private readonly userWalletRepository: IUserWalletRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    private readonly eventPublisher: WalletEventPublisher,
  ) {}

  private toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  private fromCents(cents: number): number {
    return cents / 100;
  }

  private formatTransaction(transaction: Transaction) {
    return {
      ...transaction,
      amount: this.fromCents(transaction.amount),
    };
  }

  async getBalance(userId: string): Promise<{ balance: number }> {
    const user = await this.userWalletRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return { balance: this.fromCents(user.balance) };
  }

  async deposit(
    userId: string,
    dto: DepositDto,
  ): Promise<{ transaction: ReturnType<WalletService['formatTransaction']> }> {
    const context: TransactionContext = {
      userId,
      amount: this.toCents(dto.amount),
      description: dto.description,
    };

    const result = await this.executeTransaction(this.depositStrategy, context);

    return { transaction: this.formatTransaction(result.transactions[0]) };
  }

  async transfer(
    userId: string,
    dto: TransferDto,
  ): Promise<{ transaction: ReturnType<WalletService['formatTransaction']> }> {
    const context: TransactionContext = {
      userId,
      recipientId: dto.recipientId,
      amount: this.toCents(dto.amount),
      description: dto.description,
    };

    const result = await this.executeTransaction(
      this.transferStrategy,
      context,
    );

    return { transaction: this.formatTransaction(result.transactions[0]) };
  }

  async reverse(
    userId: string,
    transactionId: string,
  ): Promise<{ transaction: ReturnType<WalletService['formatTransaction']> }> {
    const context: TransactionContext = {
      userId,
      transactionId,
    };

    const result = await this.executeTransaction(
      this.reversalStrategy,
      context,
    );

    return { transaction: this.formatTransaction(result.transactions[0]) };
  }

  async getTransactions(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<{
    data: ReturnType<WalletService['formatTransaction']>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, type } = query;

    const result = await this.transactionRepository.findByUserId(userId, {
      page,
      limit,
      type,
    });

    return {
      data: result.data.map((t) => this.formatTransaction(t)),
      total: result.total,
      page,
      limit,
    };
  }

  private async executeTransaction(
    strategy: TransactionStrategy,
    context: TransactionContext,
  ): Promise<{ transactions: Transaction[]; events: WalletEventPayload[] }> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await strategy.execute(context, queryRunner);

      await queryRunner.commitTransaction();

      this.publishEvents(result.events);

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private publishEvents(events: WalletEventPayload[]): void {
    for (const event of events) {
      this.eventPublisher.publish(event).catch((error) => {
        this.logger.error(
          `Failed to publish event ${event.event}: ${error.message}`,
        );
      });
    }
  }
}
