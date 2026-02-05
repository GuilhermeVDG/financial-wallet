import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserMeResponse } from '../../shared/swagger/user-profile.response';
import { PublicRoute } from '../../shared/decorators/public-route.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @PublicRoute()
  @ApiOperation({
    summary: 'Login',
    description: 'Autentica o usuario e retorna um JWT.',
  })
  @ApiOkResponse({
    description:
      'Login realizado com sucesso. Retorna dados do usuario e access_token.',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Credenciais invalidas.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Perfil do usuario',
    description: 'Retorna os dados do usuario autenticado, incluindo saldo.',
  })
  @ApiOkResponse({
    description: 'Dados do usuario autenticado.',
    type: UserMeResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, invalido ou expirado.',
  })
  getMe(@Request() req: { user: { id: string } }) {
    return this.authService.getMe(req.user.id);
  }
}
