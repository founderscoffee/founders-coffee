import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createCloudflareEmailProvider } from './cloudflare-provider.js';

const DEFAULT_FROM = 'noreply@founders.coffee';

const baseInput = {
  to: 'ok@example.com',
  subject: 'Your RSVP is confirmed',
  html: '<p>See you Saturday.</p>',
};

describe('CloudflareEmailProvider (real Miniflare EMAIL binding)', () => {
  it('sends to an allowed recipient and returns a messageId', async () => {
    const provider = createCloudflareEmailProvider(env.EMAIL, DEFAULT_FROM);
    const result = await provider.send(baseInput);

    expect(result.ok).toBe(true);
    if (result.ok) expect(typeof result.data.messageId).toBe('string');
  });

  it('returns err with a providerCode when the recipient is not allowed', async () => {
    const provider = createCloudflareEmailProvider(env.EMAIL, DEFAULT_FROM);
    const result = await provider.send({
      ...baseInput,
      to: 'blocked@example.com',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('email_send_failed');
      const details = result.error.details as { providerCode: string };
      expect(details.providerCode).toBeTruthy();
    }
  });

  it('honours an explicit input.from over defaultFrom', async () => {
    const provider = createCloudflareEmailProvider(env.EMAIL, DEFAULT_FROM);
    const result = await provider.send({
      ...baseInput,
      from: 'events@founders.coffee',
    });

    expect(result.ok).toBe(true);
  });
});
