import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty({ example: 1000.0, description: 'Saldo atual em reais' })
  balance: number;
}
