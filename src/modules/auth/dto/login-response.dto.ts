import { ApiProperty } from '@nestjs/swagger';
import { UserProfileResponse } from '../../../shared/swagger/user-profile.response';

export class LoginResponseDto {
  @ApiProperty({ type: UserProfileResponse })
  user: UserProfileResponse;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token',
  })
  access_token: string;
}
