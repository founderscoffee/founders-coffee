import { describe, expect, it } from 'vitest';

import { withNotAcceptableForPages } from './not-acceptable';

const requestAccepting = (accept?: string): Request =>
  new Request(
    'https://founders.coffee/ar/algeria',
    accept === undefined ? {} : { headers: { accept } },
  );

const startRefusal = (): Response =>
  Response.json(
    { error: 'Only HTML requests are supported here' },
    { status: 500 },
  );

describe('withNotAcceptableForPages', () => {
  it.each(['application/json', 'application/json, text/plain', 'image/*'])(
    'answers 406 where Start refused a page to a client accepting %s',
    async (accept) => {
      const response = await withNotAcceptableForPages(
        requestAccepting(accept),
        startRefusal(),
      );

      expect(response.status).toBe(406);
      expect(response.headers.get('vary')).toBe('Accept');
      expect(response.headers.get('content-type')).toContain('text/plain');
    },
  );

  it.each([
    ['takes HTML', 'text/html,application/xhtml+xml'],
    ['takes any type', 'application/json, */*;q=0.8'],
    ['names no type', undefined],
  ])(
    'leaves a refusal alone for a client that %s, which Start would not refuse',
    async (_case, accept) => {
      const refusal = startRefusal();

      expect(
        await withNotAcceptableForPages(requestAccepting(accept), refusal),
      ).toBe(refusal);
    },
  );

  it('passes any other server error through, as a JSON route answered it', async () => {
    const failure = Response.json({ error: 'internal' }, { status: 500 });

    const response = await withNotAcceptableForPages(
      requestAccepting('application/json'),
      failure,
    );

    expect(response).toBe(failure);
    expect(await response.json()).toEqual({ error: 'internal' });
  });

  it('passes a server error that is not JSON through', async () => {
    const failure = new Response('Only HTML requests are supported here', {
      status: 500,
    });

    expect(
      await withNotAcceptableForPages(
        requestAccepting('application/json'),
        failure,
      ),
    ).toBe(failure);
  });

  it('leaves every answer that is not a server error alone', async () => {
    const page = Response.json({ items: [] }, { status: 200 });

    expect(
      await withNotAcceptableForPages(
        requestAccepting('application/json'),
        page,
      ),
    ).toBe(page);
  });
});
