import { AppError } from './result.js';

/**
 * Typed env accessors. Pure: the caller passes the runtime env object
 * (the Workers `env`, from `cloudflare:workers` or the fetch handler arg), so `core`
 * stays Workers-agnostic and testable with a plain object.
 */
export type Env = Record<string, string | undefined>;

/** Read a required string env var; throws `AppError('env_missing')` if absent/empty. */
export function requireEnv(env: Env, key: string): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new AppError('env_missing', `Missing required env var: ${key}`);
  }
  return value;
}

/** Read an optional string env var. */
export function optionalEnv(env: Env, key: string): string | undefined {
  return env[key];
}
