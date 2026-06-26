/**
 * App-level configuration (identity, deployment environment, default market).
 * Pure data + a validating factory.
 */
export type AppEnvironment = 'development' | 'staging' | 'production';

export interface AppConfig {
  readonly name: string;
  readonly env: AppEnvironment;
  readonly defaultMarketCode: string;
}

const VALID_ENVIRONMENTS: readonly AppEnvironment[] = [
  'development',
  'staging',
  'production',
];

export function createConfig(
  input: Partial<AppConfig> & Pick<AppConfig, 'name'>,
): AppConfig {
  const env = input.env ?? 'development';
  if (!VALID_ENVIRONMENTS.includes(env)) {
    throw new Error(`Invalid AppEnvironment: ${String(env)}`);
  }
  return {
    name: input.name,
    env,
    defaultMarketCode: input.defaultMarketCode ?? 'DZ',
  };
}
