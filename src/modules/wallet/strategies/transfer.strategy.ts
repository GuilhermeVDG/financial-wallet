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
export class TransferStrategy implements TransactionStrategy {
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
    const { userId: senderId, recipientId, amount, description } = context;

    if (!amount || amount <= 0) {
      throw new BadRequestException(
        'Transfer amount must be greater than zero',
      );
    }

    if (!recipientId) {
      throw new BadRequestException('Recipient ID is required');
    }

    if (senderId === recipientId) {
      throw new ConflictException('Cannot transfer to yourself');
    }

    // Lock users in deterministic order to prevent deadlocks
    const [firstId, secondId] =
      senderId < recipientId
        ? [senderId, recipientId]
        : [recipientId, senderId];

    const firstUser = await this.userWalletRepository.findByIdWithLock(
      firstId,
      queryRunner,
    );
    const secondUser = await this.userWalletRepository.findByIdWithLock(
      secondId,
      queryRunner,
    );

    const sender = firstId === senderId ? firstUser : secondUser;
    const recipient = firstId === recipientId ? firstUser : secondUser;

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    if (sender.balance < amount) {
      throw new ConflictException('Insufficient balance');
    }

    const newSenderBalance = sender.balance - amount;
    const newRecipientBalance = recipient.balance + amount;

    await this.userWalletRepository.updateBalance(
      senderId,
      newSenderBalance,
      queryRunner,
    );

    await this.userWalletRepository.updateBalance(
      recipientId,
      newRecipientBalance,
      queryRunner,
    );

    // Create debit transaction for sender
    const debitData = this.transactionFactory.createTransferDebit({
      senderId,
      recipientId,
      amount,
      description,
    });
    const debitTransaction = await this.transactionRepository.create(
      debitData,
      queryRunner,
    );

    // Create credit transaction for recipient, linked to debit
    const creditData = this.transactionFactory.createTransferCredit({
      senderId,
      recipientId,
      amount,
      relatedTransactionId: debitTransaction.id,
      description,
    });
    const creditTransaction = await this.transactionRepository.create(
      creditData,
      queryRunner,
    );

    return {
      transactions: [debitTransaction, creditTransaction],
      events: [
        {
          event: WalletEvent.TRANSFER_COMPLETED,
          timestamp: new Date().toISOString(),
          data: {
            debitTransactionId: debitTransaction.id,
            creditTransactionId: creditTransaction.id,
            senderId,
            recipientId,
            amount,
            newSenderBalance,
            newRecipientBalance,
          },
        },
      ],
    };
  }
}
