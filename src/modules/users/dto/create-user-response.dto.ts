import { ApiProperty } from '@nestjs/swagger';
import { UserProfileWithBalanceResponse } from '../../../shared/swagger/user-profile.response';

export class CreateUserResponseDto {
  @ApiProperty({ type: UserProfileWithBalanceResponse })
  user: UserProfileWithBalanceResponse;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT para autenticacao imediata',
  })
  access_token: string;
}
