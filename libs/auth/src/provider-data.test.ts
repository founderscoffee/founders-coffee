import {
  account as accountTable,
  createDb,
  eq,
  user as userTable,
} from '@founders-coffee/db';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createAuth } from './auth.js';
import { authEnv } from './auth.fixtures.js';
import { DevEmailProvider } from './providers/email.js';

const PROVIDER_TOKENS = {
  accessToken: 'gho_live-access',
  refreshToken: 'live-refresh',
  idToken: 'eyJ.claims-with-picture.signature',
  accessTokenExpiresAt: new Date('2099-01-01T00:00:00Z'),
  refreshTokenExpiresAt: new Date('2099-01-01T00:00:00Z'),
};

const NO_TOKENS = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
};

const internalAdapter = async () => {
  const { auth } = createAuth(authEnv, {
    emailProvider: new DevEmailProvider(),
  });
  return (await auth.$context).internalAdapter;
};

const storedAccount = (id: string) =>
  createDb(env.DB)
    .select()
    .from(accountTable)
    .where(eq(accountTable.id, id))
    .get();

const storedUser = (id: string) =>
  createDb(env.DB).select().from(userTable).where(eq(userTable.id, id)).get();

describe('what a Google or GitHub sign-in keeps (real D1 via Miniflare)', () => {
  it('keeps the link to the provider, and neither its tokens nor the picture', async () => {
    const adapter = await internalAdapter();

    const created = await adapter.createOAuthUser(
      {
        email: 'octo-founder@example.dz',
        name: 'Octo Founder',
        emailVerified: true,
        image: 'https://avatars.githubusercontent.com/u/5875',
      },
      {
        providerId: 'github',
        accountId: '5875',
        scope: 'read:user,user:email',
        ...PROVIDER_TOKENS,
      },
    );

    expect(
      await storedUser(created.user.id),
      'nothing shows the picture a provider sends, so its address is not kept',
    ).toMatchObject({ name: 'Octo Founder', image: null });
    expect(
      await storedAccount(created.account?.id ?? ''),
      'the sign-in reads the tokens while it runs; stored, they would only be live keys to the member’s account there',
    ).toMatchObject({ providerId: 'github', accountId: '5875', ...NO_TOKENS });
  });

  it('stores no token when a later sign-in refreshes the account', async () => {
    const adapter = await internalAdapter();
    const created = await adapter.createOAuthUser(
      {
        email: 'returning-founder@example.dz',
        name: 'Returning Founder',
        emailVerified: true,
      },
      { providerId: 'google', accountId: 'google-sub-returning' },
    );
    const accountId = created.account?.id ?? '';

    await adapter.updateAccount(accountId, PROVIDER_TOKENS);

    expect(await storedAccount(accountId)).toMatchObject({
      providerId: 'google',
      ...NO_TOKENS,
    });
  });

  it('stores no token when an email member links Google', async () => {
    const adapter = await internalAdapter();
    const member = await adapter.createUser({
      email: 'email-first@example.dz',
      name: 'Email First',
      emailVerified: true,
    });

    const linked = await adapter.linkAccount({
      userId: member.id,
      providerId: 'google',
      accountId: 'google-sub-linked',
      ...PROVIDER_TOKENS,
    });

    expect(await storedAccount(linked?.id ?? '')).toMatchObject({
      providerId: 'google',
      accountId: 'google-sub-linked',
      ...NO_TOKENS,
    });
  });
});
