import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserResponseDto } from './dto/create-user-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar usuario',
    description:
      'Registra um novo usuario com saldo inicial opcional e retorna JWT para uso imediato.',
  })
  @ApiCreatedResponse({
    description:
      'Usuario criado com sucesso. Retorna dados do usuario e access_token.',
    type: CreateUserResponseDto,
  })
  @ApiConflictResponse({ description: 'Email ja cadastrado.' })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: user.balance / 100,
      },
      access_token: token,
    };
  }
}
