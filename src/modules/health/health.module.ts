import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RabbitMqHealthIndicator } from './indicators/rabbitmq.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RabbitMqHealthIndicator],
})
export class HealthModule {}
