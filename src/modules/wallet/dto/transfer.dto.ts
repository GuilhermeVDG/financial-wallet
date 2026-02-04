import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class TransferDto {
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}
