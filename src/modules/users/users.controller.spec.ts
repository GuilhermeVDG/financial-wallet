import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '../../domain/entities/user.entity';
import { JwtService } from '@nestjs/jwt';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user and return a CreateUserResponseDto', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password',
      };
      const createdUser: User = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        transactions: [],
      };
      const token = 'jwt-token';

      jest.spyOn(service, 'create').mockResolvedValue(createdUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue(token);

      const result = await controller.create(createUserDto);

      expect(service.create).toHaveBeenCalledWith(createUserDto);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: createdUser.id,
        email: createdUser.email,
      });
      expect(result).toEqual({
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          balance: createdUser.balance / 100,
        },
        access_token: token,
      });
    });
  });
});
