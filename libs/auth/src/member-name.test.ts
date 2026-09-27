import { id } from '@founders-coffee/core';
import { createDb, eq, user as userTable } from '@founders-coffee/db';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createAuth } from './auth.js';
import { authEnv, signIn } from './auth.fixtures.js';
import { DevEmailProvider } from './providers/email.js';

const nameOf = async (email: string) => {
  const [row] = await createDb(env.DB)
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, email));
  return row?.name;
};

const existingMember = (email: string, name: string) =>
  createDb(env.DB)
    .insert(userTable)
    .values({ id: id('usr'), email, name, emailVerified: true });

const providerSignUp = async (
  provider: 'google' | 'github',
  account: { email: string; name: string },
) => {
  const { auth } = createAuth(authEnv, {
    emailProvider: new DevEmailProvider(),
  });
  const context = await auth.$context;
  await context.internalAdapter.createOAuthUser(
    { ...account, emailVerified: true },
    { providerId: provider, accountId: `${provider}-${account.email}` },
  );
};

describe('a member is named from their email, with no step to ask (#119, real D1 via Miniflare)', () => {
  it('names an email sign-up from its address', async () => {
    const { response } = await signIn('sara.benali+work@example.dz');

    expect(response.status).toBe(200);
    expect(await nameOf('sara.benali+work@example.dz')).toBe('Sara Benali');
  });

  it('leaves the name empty when the address holds no letters', async () => {
    const { response } = await signIn('0555123456@example.dz');

    expect(response.status).toBe(200);
    expect(await nameOf('0555123456@example.dz')).toBe('');
  });

  it('keeps the name a Google sign-up brings', async () => {
    await providerSignUp('google', {
      email: 'ah1990@example.dz',
      name: 'Amina Haddad',
    });

    expect(await nameOf('ah1990@example.dz')).toBe('Amina Haddad');
  });

  it('reads the email for a provider sign-up that brings no name', async () => {
    await providerSignUp('github', { email: 'karim.b@example.dz', name: '' });

    expect(await nameOf('karim.b@example.dz')).toBe('Karim B');
  });

  it('names a member created before, at their next sign-in', async () => {
    await existingMember('nadia.amrani@example.dz', '');

    const { response } = await signIn('nadia.amrani@example.dz');

    expect(response.status).toBe(200);
    expect(await nameOf('nadia.amrani@example.dz')).toBe('Nadia Amrani');
  });

  it('replaces a name that is the email address itself', async () => {
    await existingMember('yacine.k@example.dz', 'Yacine.K@example.dz');

    await signIn('yacine.k@example.dz');

    expect(await nameOf('yacine.k@example.dz')).toBe('Yacine K');
  });

  it('keeps the name a member already has', async () => {
    await existingMember('lina.m@example.dz', 'Lina');

    await signIn('lina.m@example.dz');

    expect(await nameOf('lina.m@example.dz')).toBe('Lina');
  });
});
