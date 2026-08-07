export interface AppConfig {
  app: {
    name: string;
    port: number;
    env: string;
    corsOrigins: string[];
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
  };
  jwt: {
    secret?: string;
    publicKey?: string;
  };
  rabbitmq: {
    url: string;
  };
  storage: {
    endpoint: string;
    publicUrl: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
  };
}

const toList = (value: string | undefined): string[] =>
  (value ?? '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default (): AppConfig => ({
  app: {
    name: process.env.APP_NAME ?? 'DotCard-API',
    port: parseInt(process.env.PORT ?? '3001', 10),
    env: process.env.NODE_ENV ?? 'development',
    corsOrigins: toList(process.env.CORS_ORIGINS),
  },
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5433', 10),
    username: process.env.POSTGRES_USER ?? 'dotcard',
    password: process.env.POSTGRES_PASSWORD ?? 'dotcard',
    name: process.env.POSTGRES_DB ?? 'dotcard',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    publicKey: process.env.JWT_PUBLIC_KEY,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:9000',
    accessKey: process.env.STORAGE_ACCESS_KEY ?? '',
    secretKey: process.env.STORAGE_SECRET_KEY ?? '',
    bucket: process.env.STORAGE_BUCKET ?? 'dotcard-cards',
    region: process.env.STORAGE_REGION ?? 'us-east-1',
  },
});
