import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import { createDb, seed } from '@founders-coffee/db';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';

const documentAt = async (pathname: string): Promise<string> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  expect(response.status, pathname).toBe(200);
  return response.text();
};

describe('the French pages put à in front of a place the way French does', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it('invites a host au Caire, never à Le Caire', async () => {
    const body = await documentAt('/fr/egypt/cairo');

    expect(body).toContain(
      'Soyez le premier à organiser une rencontre pro au Caire',
    );
    expect(
      body,
      'the page repeats the invitation in its heading, its meta descriptions and its JSON-LD',
    ).not.toMatch(/à Le Caire/u);
  });

  it('invites a host aux Eucalyptus, never à Les Eucalyptus', async () => {
    const body = await documentAt('/fr/algeria/les-eucalyptus');

    expect(body).toContain(
      'Soyez le premier à organiser une rencontre pro aux Eucalyptus',
    );
    expect(body).not.toMatch(/à Les Eucalyptus/u);
  });
});
