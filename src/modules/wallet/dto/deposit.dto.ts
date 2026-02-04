import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class DepositDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}
