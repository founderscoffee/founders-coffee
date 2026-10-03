import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { socialCallbacks } from '../src/lib/redirect';
import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';

const MEETUP = encodeURI(
  '/ar/algeria/e/عندي-مشروع-في-وهران-ونحوس-على-مستثمرين',
);

const withGoogle = {
  ...env,
  GOOGLE_CLIENT_ID: 'test-google-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
};

const startSignIn = async (body: object): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ provider: 'google', ...body }),
    }),
    withGoogle,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('POST /api/auth/sign-in/social', () => {
  it('sends a reader from an Arabic meetup page on to Google', async () => {
    const response = await startSignIn(
      socialCallbacks(
        { callbackURL: MEETUP, newUserCallbackURL: MEETUP },
        ORIGIN,
      ),
    );

    expect(
      response.status,
      'production refused this sign-in with 403 Invalid callbackURL while the meetup was sent as a relative path',
    ).toBe(200);
    const { url } = (await response.json()) as { url: string };
    expect(new URL(url).origin).toBe('https://accounts.google.com');
  });
});
