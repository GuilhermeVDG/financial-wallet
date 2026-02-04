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
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../../shared/enums/transaction-status.enum';
import { WalletEvent } from '../events/wallet-events.enum';
import { Transaction } from '../../../domain/entities/transaction.entity';

@Injectable()
export class ReversalStrategy implements TransactionStrategy {
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
    const { userId, transactionId } = context;

    if (!transactionId) {
      throw new BadRequestException('Transaction ID is required');
    }

    const originalTransaction =
      await this.transactionRepository.findByIdWithLock(
        transactionId,
        queryRunner,
      );

    if (!originalTransaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (originalTransaction.status === TransactionStatus.REVERSED) {
      throw new ConflictException('Transaction has already been reversed');
    }

    if (originalTransaction.type === TransactionType.REVERSAL) {
      throw new ConflictException('Cannot reverse a reversal transaction');
    }

    // Ensure the user owns this transaction
    if (originalTransaction.userId !== userId) {
      throw new NotFoundException('Transaction not found');
    }

    if (originalTransaction.type === TransactionType.DEPOSIT) {
      return this.reverseDeposit(originalTransaction, queryRunner);
    }

    if (originalTransaction.type === TransactionType.TRANSFER) {
      return this.reverseTransfer(originalTransaction, queryRunner);
    }

    throw new BadRequestException('Unsupported transaction type for reversal');
  }

  private async reverseDeposit(
    original: Transaction,
    queryRunner: QueryRunner,
  ): Promise<TransactionResult> {
    const amount = original.amount;

    const user = await this.userWalletRepository.findByIdWithLock(
      original.userId,
      queryRunner,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newBalance = user.balance - amount;

    await this.userWalletRepository.updateBalance(
      original.userId,
      newBalance,
      queryRunner,
    );

    // Mark original as reversed
    await this.transactionRepository.updateStatus(
      original.id,
      TransactionStatus.REVERSED,
      queryRunner,
    );

    // Create reversal record
    const reversalData = this.transactionFactory.createReversal({
      userId: original.userId,
      amount,
      originalTransactionId: original.id,
      description: `Reversal of deposit ${original.id}`,
    });

    const reversalTransaction = await this.transactionRepository.create(
      reversalData,
      queryRunner,
    );

    return {
      transactions: [reversalTransaction],
      events: [
        {
          event: WalletEvent.REVERSAL_COMPLETED,
          timestamp: new Date().toISOString(),
          data: {
            reversalTransactionId: reversalTransaction.id,
            originalTransactionId: original.id,
            userId: original.userId,
            amount,
            newBalance,
          },
        },
      ],
    };
  }

  private async reverseTransfer(
    original: Transaction,
    queryRunner: QueryRunner,
  ): Promise<TransactionResult> {
    const amount = original.amount;

    if (!original.relatedUserId) {
      throw new BadRequestException(
        'Transfer transaction is missing related user',
      );
    }

    // Lock users in deterministic order to prevent deadlocks
    const senderId = original.userId;
    const recipientId = original.relatedUserId;

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

    if (!sender || !recipient) {
      throw new NotFoundException('One of the users involved was not found');
    }

    // Reverse: give money back to sender, take from recipient
    const newSenderBalance = sender.balance + amount;
    const newRecipientBalance = recipient.balance - amount;

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

    // Mark original debit transaction as reversed
    await this.transactionRepository.updateStatus(
      original.id,
      TransactionStatus.REVERSED,
      queryRunner,
    );

    // Find and mark the related credit transaction as reversed
    const relatedCreditTransaction =
      await this.transactionRepository.findRelatedTransferTransaction(
        original.id,
        queryRunner,
      );

    if (relatedCreditTransaction) {
      await this.transactionRepository.updateStatus(
        relatedCreditTransaction.id,
        TransactionStatus.REVERSED,
        queryRunner,
      );
    }

    // Create reversal record for sender (money returned)
    const senderReversalData = this.transactionFactory.createReversal({
      userId: senderId,
      amount,
      originalTransactionId: original.id,
      relatedUserId: recipientId,
      description: `Reversal of transfer ${original.id}`,
    });
    const senderReversal = await this.transactionRepository.create(
      senderReversalData,
      queryRunner,
    );

    // Create reversal record for recipient (money taken back)
    const recipientReversalData = this.transactionFactory.createReversal({
      userId: recipientId,
      amount,
      originalTransactionId: relatedCreditTransaction?.id || original.id,
      relatedUserId: senderId,
      description: `Reversal of transfer ${original.id}`,
    });
    const recipientReversal = await this.transactionRepository.create(
      recipientReversalData,
      queryRunner,
    );

    return {
      transactions: [senderReversal, recipientReversal],
      events: [
        {
          event: WalletEvent.REVERSAL_COMPLETED,
          timestamp: new Date().toISOString(),
          data: {
            senderReversalId: senderReversal.id,
            recipientReversalId: recipientReversal.id,
            originalTransactionId: original.id,
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
