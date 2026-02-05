import { ApiProperty } from '@nestjs/swagger';

export class UserProfileResponse {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({ example: 'Alice Silva' })
  name: string;

  @ApiProperty({ example: 'alice@email.com', format: 'email' })
  email: string;
}

export class UserProfileWithBalanceResponse extends UserProfileResponse {
  @ApiProperty({ example: 1000.0, description: 'Saldo em reais' })
  balance: number;
}

export class UserMeResponse extends UserProfileWithBalanceResponse {
  @ApiProperty({ example: '2026-02-04T03:00:00.000Z', format: 'date-time' })
  createdAt: Date;
}
