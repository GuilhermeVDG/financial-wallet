import { Inject, Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import {
  TransactionContext,
  TransactionResult,
  TransactionStrategy,
} from './transaction-strategy.interface';
import {
  IUserWalletRepository,
  USER_WALLET_REPOSITORY,
} from '../repositories/user-wallet.repository.interface';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../repositories/transaction.repository.interface';
import { TransactionFactory } from '../factories/transaction.factory';
import { WalletEvent } from '../events/wallet-events.enum';

@Injectable()
export class DepositStrategy implements TransactionStrategy {
  constructor(
    @Inject(USER_WALLET_REPOSITORY)
    private readonly userWalletRepository: IUserWalletRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    private readonly transactionFactory: TransactionFactory,
  ) {}

  async execute(
    context: TransactionContext,
    queryRunner: QueryRunner,
  ): Promise<TransactionResult> {
    const { userId, amount, description } = context;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Deposit amount must be greater than zero');
    }

    const user = await this.userWalletRepository.findByIdWithLock(
      userId,
      queryRunner,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.balance < 0) {
      throw new ConflictException(
        'Deposits are not allowed when balance is negative',
      );
    }

    const newBalance = user.balance + amount;

    await this.userWalletRepository.updateBalance(
      userId,
      newBalance,
      queryRunner,
    );

    const transactionData = this.transactionFactory.createDeposit({
      userId,
      amount,
      description,
    });

    const transaction = await this.transactionRepository.create(
      transactionData,
      queryRunner,
    );

    return {
      transactions: [transaction],
      events: [
        {
          event: WalletEvent.DEPOSIT_COMPLETED,
          timestamp: new Date().toISOString(),
          data: {
            transactionId: transaction.id,
            userId,
            amount,
            newBalance,
          },
        },
      ],
    };
  }
}
