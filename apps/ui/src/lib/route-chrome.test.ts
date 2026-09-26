import { describe, expect, it, vi } from 'vitest';

import { hasOwnMobileHeader } from './route-chrome';

vi.mock('@founders-coffee/server-fns', () => ({
  getPublicAuthConfig: vi.fn(),
}));

vi.mock('../features/events/api', () => ({ eventsApi: {} }));

vi.mock('../components/host/HostCreatePage', () => ({
  HostCreatePage: () => null,
}));

const { Route: HostCreateRoute } =
  await import('../routes/$locale.$market.host.create');

describe('which pages draw their own header on a phone', () => {
  it('is the host wizard, which needs the height for its map', () => {
    expect(
      HostCreateRoute.options.staticData?.hasOwnMobileHeader,
      'the site header stacked a second bar over the wizard’s own on a phone (#121)',
    ).toBe(true);
  });

  it('hides the site header only when a page on screen asks for it', () => {
    expect(
      hasOwnMobileHeader([
        { staticData: {} },
        { staticData: { hasOwnMobileHeader: true } },
      ]),
    ).toBe(true);
    expect(hasOwnMobileHeader([{ staticData: {} }])).toBe(false);
  });
});
