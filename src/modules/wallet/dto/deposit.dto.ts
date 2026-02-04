import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepositDto {
  @ApiProperty({
    example: 500.5,
    description: 'Valor em reais (max 2 casas decimais)',
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    example: 'Deposito mensal',
    description: 'Descricao opcional',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
