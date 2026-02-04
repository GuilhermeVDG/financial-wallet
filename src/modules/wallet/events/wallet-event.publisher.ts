import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, ChannelModel, Channel } from 'amqplib';
import { WalletEventPayload } from './wallet-event.interface';

@Injectable()
export class WalletEventPublisher {
  private readonly logger = new Logger(WalletEventPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly exchange: string;
  private readonly uri: string;

  constructor(private readonly configService: ConfigService) {
    this.exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'wallet_events',
    );
    this.uri = this.configService.get<string>(
      'RABBITMQ_URI',
      'amqp://guest:guest@localhost:5672',
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      this.connection = await connect(this.uri);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });
      this.logger.log('RabbitMQ connection established');
    } catch (error) {
      this.logger.warn(
        `Failed to connect to RabbitMQ: ${error.message}. Events will not be published.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.warn(`Error closing RabbitMQ connection: ${error.message}`);
    }
  }

  async publish(payload: WalletEventPayload): Promise<void> {
    if (!this.channel) {
      this.logger.warn(
        `RabbitMQ channel not available. Skipping event: ${payload.event}`,
      );
      return;
    }

    try {
      this.channel.publish(
        this.exchange,
        payload.event,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );
      this.logger.debug(`Event published: ${payload.event}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${payload.event}: ${error.message}`,
      );
    }
  }
}
