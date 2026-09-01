import { AppError } from './result.js';

export type Env = Record<string, string | undefined>;

/** Read a required string env var; throws `AppError('env_missing')` if absent/empty. */
export const requireEnv = (env: Env, key: string): string => {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new AppError('env_missing', `Missing required env var: ${key}`);
  }
  return value;
};

/** Read an optional string env var. */
export const optionalEnv = (env: Env, key: string): string | undefined =>
  env[key];
