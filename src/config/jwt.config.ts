import { JwtVerifyOptions } from '@nestjs/jwt';
import { AppConfig } from './configuration';

/**
 * Resolves HS256 (shared secret) vs RS256 (public key) verification options
 * from config. DotCard-API never signs a token, so only the verify side of
 * AuthForge's buildAccessTokenOptions is needed here — switching to RS256
 * later is a config-only change (fill JWT_PUBLIC_KEY, drop JWT_SECRET).
 */
export function buildJwtVerifyOptions(config: AppConfig['jwt']): JwtVerifyOptions {
  if (config.publicKey) {
    return { algorithms: ['RS256'], publicKey: config.publicKey };
  }

  return { algorithms: ['HS256'], secret: config.secret };
}
