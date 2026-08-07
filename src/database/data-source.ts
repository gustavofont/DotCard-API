import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

config();

/**
 * Standalone DataSource used by the TypeORM CLI (migration:generate/run/revert)
 * and the seed script. Runtime NestJS wiring lives in database.module.ts.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5433', 10),
  username: process.env.POSTGRES_USER ?? 'dotcard',
  password: process.env.POSTGRES_PASSWORD ?? 'dotcard',
  database: process.env.POSTGRES_DB ?? 'dotcard',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
