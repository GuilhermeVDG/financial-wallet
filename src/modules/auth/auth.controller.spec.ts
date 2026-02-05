import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            getMe: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return a LoginResponseDto when login is successful', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
      };
      const expectedResponse: LoginResponseDto = {
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
        },
        access_token: 'some-jwt-token',
      };

      jest.spyOn(service, 'login').mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResponse);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('getMe', () => {
    it('should return the user profile', async () => {
      const req = { user: { id: '1' } };
      const expectedResponse = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        balance: 1000,
        createdAt: new Date(),
      };

      jest.spyOn(service, 'getMe').mockResolvedValue(expectedResponse);

      const result = await controller.getMe(req);

      expect(result).toEqual(expectedResponse);
      expect(service.getMe).toHaveBeenCalledWith('1');
    });
  });
});
