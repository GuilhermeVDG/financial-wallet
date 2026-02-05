import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../enums/transaction-type.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';

export class TransactionResponse {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  userId: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.DEPOSIT })
  type: TransactionType;

  @ApiProperty({ example: 500.5, description: 'Valor em reais' })
  amount: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
    nullable: true,
    description: 'ID do usuario relacionado (em transferencias)',
  })
  relatedUserId: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440003',
    format: 'uuid',
    nullable: true,
    description:
      'ID da transacao relacionada (em reversoes e creditos de transferencia)',
  })
  relatedTransactionId: string | null;

  @ApiProperty({
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @ApiPropertyOptional({ example: 'Deposito mensal', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-02-04T03:00:00.000Z', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-04T03:00:00.000Z', format: 'date-time' })
  updatedAt: Date;
}
