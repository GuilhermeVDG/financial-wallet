import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WalletEventPublisher } from './wallet-event.publisher';
import { WalletEvent } from './wallet-events.enum';
import { WalletEventPayload } from './wallet-event.interface';

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import { connect } from 'amqplib';

const mockConnect = connect as jest.Mock;

describe('WalletEventPublisher', () => {
  let publisher: WalletEventPublisher;
  let mockChannel: Record<string, jest.Mock>;
  let mockConnection: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockChannel = {
      assertExchange: jest.fn(),
      publish: jest.fn(),
      close: jest.fn(),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn(),
    };

    mockConnect.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletEventPublisher,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                RABBITMQ_EXCHANGE: 'test_exchange',
                RABBITMQ_URI: 'amqp://localhost:5672',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    publisher = module.get<WalletEventPublisher>(WalletEventPublisher);
  });

  it('should be defined', () => {
    expect(publisher).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to RabbitMQ and create channel', async () => {
      mockConnect.mockResolvedValue(mockConnection);

      await publisher.onModuleInit();

      expect(mockConnect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'test_exchange',
        'topic',
        { durable: true },
      );
    });

    it('should handle connection failure gracefully', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      await expect(publisher.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('publish', () => {
    const payload: WalletEventPayload = {
      event: WalletEvent.DEPOSIT_COMPLETED,
      timestamp: new Date().toISOString(),
      data: { transactionId: 'tx-1', amount: 5000 },
    };

    it('should publish event to exchange', async () => {
      mockConnect.mockResolvedValue(mockConnection);
      await publisher.onModuleInit();

      await publisher.publish(payload);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test_exchange',
        payload.event,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );
    });

    it('should skip publishing when channel is not available', async () => {
      // Don't call onModuleInit → channel is null
      await publisher.publish(payload);

      expect(mockChannel.publish).not.toHaveBeenCalled();
    });

    it('should handle publish error gracefully', async () => {
      mockConnect.mockResolvedValue(mockConnection);
      await publisher.onModuleInit();

      mockChannel.publish.mockImplementation(() => {
        throw new Error('Publish failed');
      });

      await expect(publisher.publish(payload)).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close channel and connection', async () => {
      mockConnect.mockResolvedValue(mockConnection);
      await publisher.onModuleInit();

      await publisher.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should handle close error gracefully', async () => {
      mockConnect.mockResolvedValue(mockConnection);
      await publisher.onModuleInit();

      mockChannel.close.mockRejectedValue(new Error('Close failed'));

      await expect(publisher.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should handle destroy when not connected', async () => {
      await expect(publisher.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
