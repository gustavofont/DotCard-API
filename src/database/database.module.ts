import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const database = configService.get('database', { infer: true });
        return {
          type: 'postgres' as const,
          host: database.host,
          port: database.port,
          username: database.username,
          password: database.password,
          database: database.name,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: true,
          synchronize: false,
          autoLoadEntities: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
