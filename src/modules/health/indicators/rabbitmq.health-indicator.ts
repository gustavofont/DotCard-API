import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import * as amqp from 'amqplib';
import { AppConfig } from '../../../config/configuration';

@Injectable()
export class RabbitMqHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const { url } = this.configService.get('rabbitmq', { infer: true });

    try {
      const connection = await amqp.connect(url, { timeout: 2000 });
      await connection.close();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'RabbitMQ check failed',
        this.getStatus(key, false, { message: String(error) }),
      );
    }
  }
}
