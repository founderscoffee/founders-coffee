import { describe, expect, it } from 'vitest';

import { resolveSession } from './auth.js';

/**
 * The auth env-injection + session-resolution path: `getAuthEnv()` reads the Workers env (DB +
 * BETTER_AUTH_SECRET + APP_URL, declared as `vars` in wrangler.test.jsonc), `createAuth` constructs
 * per call, and `getSession` reads the cookie. The `authMiddleware`/`requirePermission` wrappers are
 * thin glue (composed over this + the authz primitive, already covered by authz.test.ts) and are
 * exercised end-to-end by the apps/ui dev smoke.
 */
describe('resolveSession (auth env-injection)', () => {
  it('constructs auth from the Workers env and resolves null for no cookie', async () => {
    const session = await resolveSession(new Headers());

    expect(session).toBeNull();
  });
});
