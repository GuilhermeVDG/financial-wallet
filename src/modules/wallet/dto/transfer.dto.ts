import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID do usuario destinatario',
  })
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({
    example: 250.0,
    description: 'Valor em reais (max 2 casas decimais)',
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    example: 'Pagamento de servico',
    description: 'Descricao opcional',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
