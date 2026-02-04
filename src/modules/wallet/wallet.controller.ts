import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@Request() req: { user: { id: string } }) {
    return this.walletService.getBalance(req.user.id);
  }

  @Post('deposit')
  deposit(@Request() req: { user: { id: string } }, @Body() dto: DepositDto) {
    return this.walletService.deposit(req.user.id, dto);
  }

  @Post('transfer')
  transfer(@Request() req: { user: { id: string } }, @Body() dto: TransferDto) {
    return this.walletService.transfer(req.user.id, dto);
  }

  @Post('reverse/:transactionId')
  reverse(
    @Request() req: { user: { id: string } },
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    return this.walletService.reverse(req.user.id, transactionId);
  }

  @Get('transactions')
  getTransactions(
    @Request() req: { user: { id: string } },
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletService.getTransactions(req.user.id, query);
  }
}
