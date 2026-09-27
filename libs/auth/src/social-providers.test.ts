import { describe, expect, it } from 'vitest';

import {
  configuredSocialProviders,
  socialCredentials,
} from './social-providers.js';

describe('which OAuth providers a deployment offers', () => {
  it('offers none while no provider is set up', () => {
    expect(configuredSocialProviders({})).toEqual([]);
  });

  it('offers only the provider that is set up', () => {
    expect(
      configuredSocialProviders({
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      }),
      'with Google set up and GitHub not, the GitHub button showed and failed when pressed',
    ).toEqual(['google']);
    expect(
      configuredSocialProviders({
        GITHUB_CLIENT_ID: 'github-id',
        GITHUB_CLIENT_SECRET: 'github-secret',
      }),
    ).toEqual(['github']);
  });

  it('does not offer a provider holding an ID but not yet its secret', () => {
    expect(
      configuredSocialProviders({
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        GITHUB_CLIENT_ID: 'github-id',
        GITHUB_CLIENT_SECRET: '',
      }),
      'production showed the GitHub button between its ID being set and its secret',
    ).toEqual(['google']);
  });

  it('offers both, in a fixed order, once both are set up', () => {
    expect(
      configuredSocialProviders({
        GITHUB_CLIENT_ID: 'github-id',
        GITHUB_CLIENT_SECRET: 'github-secret',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      }),
    ).toEqual(['google', 'github']);
  });

  it('hands createAuth the client it offers', () => {
    expect(
      socialCredentials(
        {
          GITHUB_CLIENT_ID: 'github-id',
          GITHUB_CLIENT_SECRET: 'github-secret',
        },
        'github',
      ),
    ).toEqual({ clientId: 'github-id', clientSecret: 'github-secret' });
    expect(
      socialCredentials({ GITHUB_CLIENT_ID: 'github-id' }, 'github'),
    ).toBeNull();
  });
});
