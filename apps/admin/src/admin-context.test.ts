import { describe, expect, it } from 'vitest';

import { resolveAdminContext } from './admin-context.js';

const ACCESS_EMAIL = 'founder@founders.coffee';

type Env = Parameters<typeof resolveAdminContext>[1];

const envWith = (overrides: Record<string, unknown> = {}): Env =>
  ({
    CF_ACCESS_DISABLED: 'true',
    CF_ACCESS_DEV_EMAIL: ACCESS_EMAIL,
    CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
    CF_ACCESS_AUD: 'aud',
    ...overrides,
  }) as unknown as Env;

const env = envWith();

const request = () => new Request('https://admin-staging.founders.coffee/');

const withSession = (user: unknown) => ({
  resolveSession: async () => (user === null ? null : { user }),
});

const operator = {
  id: 'usr_operator',
  email: ACCESS_EMAIL,
  role: 'admin' as const,
};

const reasonOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { error: string }).error;

describe('an operator whose two identities agree', () => {
  it('is admitted, carrying both identity keys for the audit trail', async () => {
    const result = await resolveAdminContext(
      request(),
      env,
      withSession(operator),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context).toEqual({
        accessSubject: 'dev',
        accessEmail: ACCESS_EMAIL,
        userId: 'usr_operator',
        role: 'admin',
      });
    }
  });

  it('admits a moderator as well as an admin', async () => {
    const result = await resolveAdminContext(
      request(),
      env,
      withSession({ ...operator, role: 'moderator' }),
    );

    expect(result.ok).toBe(true);
  });

  it('does not care how the identity provider capitalised the address', async () => {
    const result = await resolveAdminContext(
      request(),
      env,
      withSession({ ...operator, email: 'Founder@Founders.Coffee' }),
    );

    expect(result.ok).toBe(true);
  });
});

describe('every way in that must fail closed', () => {
  it('refuses a request Access never vouched for', async () => {
    const result = await resolveAdminContext(
      request(),
      envWith({ CF_ACCESS_DISABLED: 'false' }),
      withSession(operator),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await reasonOf(result.response)).toMatch(/Cf-Access-Jwt/);
    }
  });

  it('refuses a verified Access identity with no session behind it', async () => {
    const result = await resolveAdminContext(request(), env, withSession(null));

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(await reasonOf(result.response)).toMatch(/No admin session/);
  });

  it('refuses a valid Access identity paired with somebody else’s session', async () => {
    const result = await resolveAdminContext(
      request(),
      env,
      withSession({ ...operator, email: 'someone.else@founders.coffee' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(await reasonOf(result.response)).toMatch(/does not match/);
  });

  it('refuses a member who is signed in but is not an operator', async () => {
    const result = await resolveAdminContext(
      request(),
      env,
      withSession({ ...operator, role: 'member' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(await reasonOf(result.response)).toMatch(/not an operator/);
  });

  it('refuses an account with no role at all rather than defaulting one', async () => {
    const result = await resolveAdminContext(
      request(),
      env,
      withSession({ id: operator.id, email: operator.email }),
    );

    expect(result.ok).toBe(false);
  });

  it('refuses a session that carries no email to correlate', async () => {
    const result = await resolveAdminContext(
      request(),
      env,
      withSession({ id: operator.id, role: 'admin' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(await reasonOf(result.response)).toMatch(/no identity/);
  });

  it('refuses when the guard is bypassed but no development email is set', async () => {
    const result = await resolveAdminContext(
      request(),
      envWith({ CF_ACCESS_DEV_EMAIL: undefined }),
      withSession(operator),
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(await reasonOf(result.response)).toMatch(/does not match/);
  });
});
