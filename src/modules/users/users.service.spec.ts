import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from '../../domain/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a user', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password',
      };
      const hashedPassword = 'hashedPassword';
      const user = new User();
      Object.assign(user, {
        id: '1',
        ...createUserDto,
        password: hashedPassword,
      });

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      jest.spyOn(userRepository, 'create').mockReturnValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await service.create(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        ...createUserDto,
        password: hashedPassword,
        balance: 0,
      });
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it('should throw a ConflictException if the user already exists', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password',
      };
      const existingUser = new User();

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(existingUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should find and return a user by email', async () => {
      const email = 'test@example.com';
      const user = new User();
      Object.assign(user, {
        id: '1',
        name: 'Test User',
        email,
        password: 'password',
      });

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      const result = await service.findByEmail(email);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual(user);
    });
  });

  describe('findById', () => {
    it('should find and return a user by id', async () => {
      const id = '1';
      const user = new User();
      Object.assign(user, {
        id,
        name: 'Test User',
        email: 'test@example.com',
        password: 'password',
      });

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      const result = await service.findById(id);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(user);
    });
  });
});
