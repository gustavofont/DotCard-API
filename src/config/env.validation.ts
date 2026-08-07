import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  POSTGRES_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  POSTGRES_PORT?: number;

  @IsOptional()
  @IsString()
  POSTGRES_USER?: string;

  @IsOptional()
  @IsString()
  POSTGRES_PASSWORD?: string;

  @IsOptional()
  @IsString()
  POSTGRES_DB?: string;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_PUBLIC_KEY?: string;

  @IsNotEmpty()
  @IsString()
  RABBITMQ_URL!: string;

  @IsOptional()
  @IsString()
  STORAGE_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  STORAGE_PUBLIC_URL?: string;

  @IsOptional()
  @IsString()
  STORAGE_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  STORAGE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STORAGE_BUCKET?: string;
}

/**
 * Fails application boot fast when required configuration is missing or
 * malformed, and enforces that either a JWT_SECRET (HS256) or a
 * JWT_PUBLIC_KEY (RS256) is present — DotCard-API only ever validates
 * tokens issued by AuthForge, it never signs one.
 */
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  const hasSecret = !!validatedConfig.JWT_SECRET;
  const hasPublicKey = !!validatedConfig.JWT_PUBLIC_KEY;

  if (!hasSecret && !hasPublicKey) {
    throw new Error('Environment validation failed: provide either JWT_SECRET or JWT_PUBLIC_KEY.');
  }

  return validatedConfig;
}
