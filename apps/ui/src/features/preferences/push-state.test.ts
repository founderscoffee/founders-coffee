import { describe, expect, it } from 'vitest';

import {
  installRequiredFor,
  pushIsActionable,
  pushStateFrom,
  type PushEnvironment,
} from './push-state';

const env = (overrides: Partial<PushEnvironment> = {}): PushEnvironment => ({
  hasNotificationApi: true,
  messagingSupported: true,
  installRequired: false,
  configured: true,
  permission: 'granted',
  registration: { registered: true, deliverable: true },
  ...overrides,
});

describe('pushStateFrom', () => {
  it('reports a browser with no notification API as unsupported', () => {
    expect(pushStateFrom(env({ hasNotificationApi: false }))).toBe(
      'unsupported',
    );
  });

  it('reports a browser the messaging library refuses as unsupported', () => {
    expect(pushStateFrom(env({ messagingSupported: false }))).toBe(
      'unsupported',
    );
  });

  it('puts installation ahead of our own configuration', () => {
    expect(
      pushStateFrom(env({ installRequired: true, configured: false })),
    ).toBe('install_required');
  });

  it('says the site is not configured before asking for permission', () => {
    expect(
      pushStateFrom(env({ configured: false, permission: 'default' })),
    ).toBe('unavailable');
  });

  it('reports a browser-level block as denied', () => {
    expect(pushStateFrom(env({ permission: 'denied' }))).toBe('denied');
  });

  it('reports a permission never asked for', () => {
    expect(pushStateFrom(env({ permission: 'default' }))).toBe('not_requested');
  });

  it('waits rather than guessing while the server has not answered', () => {
    expect(pushStateFrom(env({ registration: null }))).toBe('checking');
  });

  it('separates permission granted from a token we actually hold', () => {
    expect(
      pushStateFrom(
        env({ registration: { registered: false, deliverable: false } }),
      ),
    ).toBe('granted_unregistered');
  });

  it('separates a held token from one that would still be delivered to', () => {
    expect(
      pushStateFrom(
        env({ registration: { registered: true, deliverable: false } }),
      ),
    ).toBe('delivery_unavailable');
  });

  it('reports the one state that means push actually works', () => {
    expect(pushStateFrom(env())).toBe('registered');
  });
});

describe('pushIsActionable', () => {
  it('offers a control only where the page can change the outcome', () => {
    expect(pushIsActionable('not_requested')).toBe(true);
    expect(pushIsActionable('granted_unregistered')).toBe(true);
  });

  it('offers none where the remedy is somewhere else', () => {
    for (const state of [
      'unsupported',
      'install_required',
      'unavailable',
      'denied',
      'delivery_unavailable',
      'registered',
      'checking',
    ] as const) {
      expect(pushIsActionable(state)).toBe(false);
    }
  });
});

describe('installRequiredFor', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
  const CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122';

  it('asks an iPhone browser tab to install first', () => {
    expect(installRequiredFor(IPHONE, false)).toBe(true);
  });

  it('asks nothing more of an installed iPhone app', () => {
    expect(installRequiredFor(IPHONE, true)).toBe(false);
  });

  it('asks nothing of a desktop browser, installed or not', () => {
    expect(installRequiredFor(CHROME, false)).toBe(false);
    expect(installRequiredFor(CHROME, true)).toBe(false);
  });
});
