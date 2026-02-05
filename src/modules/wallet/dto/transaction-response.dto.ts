import { ApiProperty } from '@nestjs/swagger';
import { TransactionResponse } from '../../../shared/swagger/transaction.response';

export class SingleTransactionResponseDto {
  @ApiProperty({ type: TransactionResponse })
  transaction: TransactionResponse;
}

export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [TransactionResponse] })
  data: TransactionResponse[];

  @ApiProperty({ example: 42, description: 'Total de registros' })
  total: number;

  @ApiProperty({ example: 1, description: 'Pagina atual' })
  page: number;

  @ApiProperty({ example: 20, description: 'Itens por pagina' })
  limit: number;
}
