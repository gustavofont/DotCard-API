import { ValueTransformer } from 'typeorm';

/**
 * pg returns bigint columns as strings (to avoid silent precision loss on
 * values beyond Number.MAX_SAFE_INTEGER). DotPoints balances/amounts never
 * realistically approach that range, so we convert back to number for a
 * DTO-friendly API instead of leaking the string representation to clients.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};
