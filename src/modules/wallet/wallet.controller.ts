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
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@ApiTags('Wallet')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({
  description: 'Token ausente, invalido ou expirado.',
})
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Consultar saldo',
    description: 'Retorna o saldo atual da carteira do usuario autenticado.',
  })
  @ApiOkResponse({ description: 'Saldo retornado com sucesso.' })
  getBalance(@Request() req: { user: { id: string } }) {
    return this.walletService.getBalance(req.user.id);
  }

  @Post('deposit')
  @ApiOperation({
    summary: 'Realizar deposito',
    description:
      'Adiciona fundos a carteira. Bloqueado se o saldo estiver negativo.',
  })
  @ApiCreatedResponse({ description: 'Deposito realizado com sucesso.' })
  @ApiBadRequestResponse({ description: 'Valor invalido.' })
  @ApiConflictResponse({ description: 'Saldo negativo impede depositos.' })
  deposit(@Request() req: { user: { id: string } }, @Body() dto: DepositDto) {
    return this.walletService.deposit(req.user.id, dto);
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Realizar transferencia',
    description:
      'Transfere fundos para outro usuario. Operacao atomica que cria registros de debito e credito.',
  })
  @ApiCreatedResponse({ description: 'Transferencia realizada com sucesso.' })
  @ApiBadRequestResponse({ description: 'Dados invalidos.' })
  @ApiNotFoundResponse({ description: 'Destinatario nao encontrado.' })
  @ApiConflictResponse({
    description: 'Saldo insuficiente ou transferencia para si mesmo.',
  })
  transfer(@Request() req: { user: { id: string } }, @Body() dto: TransferDto) {
    return this.walletService.transfer(req.user.id, dto);
  }

  @Post('reverse/:transactionId')
  @ApiOperation({
    summary: 'Reverter transacao',
    description:
      'Reverte um deposito ou transferencia, restaurando os saldos ao estado anterior. Cada transacao so pode ser revertida uma vez.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'UUID da transacao a ser revertida',
    format: 'uuid',
  })
  @ApiCreatedResponse({ description: 'Reversao realizada com sucesso.' })
  @ApiBadRequestResponse({ description: 'UUID invalido.' })
  @ApiNotFoundResponse({
    description: 'Transacao nao encontrada ou pertence a outro usuario.',
  })
  @ApiConflictResponse({
    description: 'Transacao ja revertida ou tipo nao reversivel.',
  })
  reverse(
    @Request() req: { user: { id: string } },
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    return this.walletService.reverse(req.user.id, transactionId);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Historico de transacoes',
    description:
      'Lista as transacoes do usuario com paginacao e filtro por tipo (DEPOSIT, TRANSFER, REVERSAL).',
  })
  @ApiOkResponse({ description: 'Lista de transacoes com paginacao.' })
  getTransactions(
    @Request() req: { user: { id: string } },
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletService.getTransactions(req.user.id, query);
  }
}
