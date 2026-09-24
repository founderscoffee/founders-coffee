import { describe, expect, it } from 'vitest';

import { createConnectToken, hashConnectToken, secretsMatch } from './token.js';

describe('Telegram connect tokens and the webhook secret', () => {
  it('makes a token Telegram carries in a startgroup link, fresh each time', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => createConnectToken()),
    );

    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('stores a hash that says nothing of the token, the same one every time', async () => {
    const token = createConnectToken();

    const hash = await hashConnectToken(token);

    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).not.toContain(token);
    expect(await hashConnectToken(token)).toBe(hash);
    expect(await hashConnectToken(createConnectToken())).not.toBe(hash);
  });

  it('matches the webhook secret only exactly', async () => {
    expect(await secretsMatch('s3cret-value', 's3cret-value')).toBe(true);
    expect(await secretsMatch('s3cret-valuf', 's3cret-value')).toBe(false);
    expect(await secretsMatch('s3cret', 's3cret-value')).toBe(false);
    expect(await secretsMatch('', 's3cret-value')).toBe(false);
  });

  it('compares every byte of the two hashes, not only where they start or end', async () => {
    const sharesFirstAndLastByte = 's3cret-value-66843';

    expect(await secretsMatch(sharesFirstAndLastByte, 's3cret-value')).toBe(
      false,
    );
  });
});
