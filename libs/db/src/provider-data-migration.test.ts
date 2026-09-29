import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { atMigration, priorHost } from './migrations.fixtures.js';

describe('0040 — no Google or GitHub token or picture kept (real D1)', () => {
  it('forgets what earlier sign-ins stored, and keeps the link to the provider', async () => {
    const { suffix, apply } = await atMigration(
      '0040_forget_provider_data.sql',
    );
    const accountId = `acc_prior_${suffix}`;
    await env.PRIOR_DB.batch([
      env.PRIOR_DB.prepare(
        `UPDATE user SET image = 'https://avatars.githubusercontent.com/u/5875' WHERE id = ?`,
      ).bind(priorHost.id),
      env.PRIOR_DB.prepare(
        `INSERT INTO account (id, user_id, provider_id, account_id, access_token, refresh_token,
           id_token, access_token_expires_at, refresh_token_expires_at, scope)
         VALUES (?, ?, 'github', '5875', 'gho_live', 'live-refresh', 'eyJ.claims.signature',
           4070908800, 4070908800, 'read:user,user:email')`,
      ).bind(accountId, priorHost.id),
    ]);

    await apply();

    expect(
      await env.PRIOR_DB.prepare('SELECT image FROM user WHERE id = ?')
        .bind(priorHost.id)
        .first(),
      'nothing shows the picture a provider sent, so its address is not kept',
    ).toEqual({ image: null });
    expect(
      await env.PRIOR_DB.prepare(
        `SELECT provider_id, account_id, access_token, refresh_token, id_token,
                access_token_expires_at, refresh_token_expires_at, scope
           FROM account WHERE id = ?`,
      )
        .bind(accountId)
        .first(),
      'no feature calls the provider after sign-in, so a stored token is only a live key to the member’s account there',
    ).toEqual({
      provider_id: 'github',
      account_id: '5875',
      access_token: null,
      refresh_token: null,
      id_token: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      scope: 'read:user,user:email',
    });
  });
});
