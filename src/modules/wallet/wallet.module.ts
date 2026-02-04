import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { Transaction } from '../../domain/entities/transaction.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { DepositStrategy } from './strategies/deposit.strategy';
import { TransferStrategy } from './strategies/transfer.strategy';
import { ReversalStrategy } from './strategies/reversal.strategy';
import { TransactionFactory } from './factories/transaction.factory';
import { UserWalletRepository } from './repositories/user-wallet.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { USER_WALLET_REPOSITORY } from './repositories/user-wallet.repository.interface';
import { TRANSACTION_REPOSITORY } from './repositories/transaction.repository.interface';
import { WalletEventPublisher } from './events/wallet-event.publisher';

@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction])],
  controllers: [WalletController],
  providers: [
    WalletService,
    DepositStrategy,
    TransferStrategy,
    ReversalStrategy,
    TransactionFactory,
    WalletEventPublisher,
    {
      provide: USER_WALLET_REPOSITORY,
      useClass: UserWalletRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },
  ],
})
export class WalletModule {}
