import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

describe('WalletController', () => {
  let controller: WalletController;
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: {
            deposit: jest.fn(),
            transfer: jest.fn(),
            getBalance: jest.fn(),
            getTransactions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('deposit', () => {
    it('should call walletService.deposit and return the result', async () => {
      const depositDto: DepositDto = { amount: 100 };
      const req = { user: { id: '1' } };
      const expectedResponse = {
        transaction: { id: '1', status: 'completed' },
      };

      jest.spyOn(service, 'deposit').mockResolvedValue(expectedResponse as any);

      const result = await controller.deposit(req, depositDto);

      expect(result).toEqual(expectedResponse);
      expect(service.deposit).toHaveBeenCalledWith('1', depositDto);
    });
  });

  describe('transfer', () => {
    it('should call walletService.transfer and return the result', async () => {
      const transferDto: TransferDto = { recipientId: '2', amount: 50 };
      const req = { user: { id: '1' } };
      const expectedResponse = {
        transaction: { id: '2', status: 'completed' },
      };

      jest
        .spyOn(service, 'transfer')
        .mockResolvedValue(expectedResponse as any);

      const result = await controller.transfer(req, transferDto);

      expect(result).toEqual(expectedResponse);
      expect(service.transfer).toHaveBeenCalledWith('1', transferDto);
    });
  });

  describe('getBalance', () => {
    it('should call walletService.getBalance and return the result', async () => {
      const req = { user: { id: '1' } };
      const expectedResponse = { balance: 1000 };

      jest.spyOn(service, 'getBalance').mockResolvedValue(expectedResponse);

      const result = await controller.getBalance(req);

      expect(result).toEqual(expectedResponse);
      expect(service.getBalance).toHaveBeenCalledWith('1');
    });
  });

  describe('getTransactions', () => {
    it('should call walletService.getTransactions and return the result', async () => {
      const req = { user: { id: '1' } };
      const query: TransactionQueryDto = { page: 1, limit: 10 };
      const expectedResponse = { data: [], total: 0, page: 1, limit: 10 };

      jest
        .spyOn(service, 'getTransactions')
        .mockResolvedValue(expectedResponse);

      const result = await controller.getTransactions(req, query);

      expect(result).toEqual(expectedResponse);
      expect(service.getTransactions).toHaveBeenCalledWith('1', query);
    });
  });
});
