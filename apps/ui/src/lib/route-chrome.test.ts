import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MakeRouteMatchUnion } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  cityCodeInView,
  hasOwnMobileHeader,
  isFocusedTask,
} from './route-chrome';

vi.mock('@founders-coffee/server-fns', () => ({
  getPublicAuthConfig: vi.fn(),
}));

vi.mock('../features/events/api', () => ({ eventsApi: {} }));

vi.mock('../components/host/HostCreatePage', () => ({
  HostCreatePage: () => null,
}));

vi.mock('../features/auth/api', () => ({ authApi: {} }));

vi.mock('../components/auth/LoginPage', () => ({ LoginPage: () => null }));

vi.mock('../features/events/components/EventEditPage', () => ({
  EventEditPage: () => null,
}));

vi.mock('../features/operations/components/CloseoutPage', () => ({
  CloseoutPage: () => null,
}));

vi.mock('../features/operations/components/FeedbackPage', () => ({
  FeedbackPage: () => null,
}));

const { Route: HostCreateRoute } =
  await import('../routes/$locale.$market.host.create');

const TASKS = [
  ['signing in', (await import('../routes/$locale.login')).Route],
  [
    'setting up a profile',
    (await import('../routes/$locale.onboarding')).Route,
  ],
  ['the host wizard', HostCreateRoute],
  ['editing a meetup', (await import('../routes/$locale.edit.$eventId')).Route],
  [
    'closing out a meetup',
    (await import('../routes/$locale.closeout.$eventId')).Route,
  ],
  [
    'reviewing a meetup',
    (await import('../routes/$locale.feedback.$eventId')).Route,
  ],
] as const;

const rootDocument = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../routes/__root.tsx'),
  'utf8',
);

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

const onPage = (routeId: string, loaderData?: unknown) =>
  ({ routeId, loaderData }) as unknown as MakeRouteMatchUnion;

const SHELL = [onPage('__root__', {}), onPage('/$locale/$market', {})];

describe('the city the site’s Host links open the wizard on', () => {
  it('is the city whose page is on screen', () => {
    expect(
      cityCodeInView([
        ...SHELL,
        onPage('/$locale/$market/$city', { city: { code: '556' } }),
      ]),
      'a reader on Algiers’ page who pressed Host arrived on the whole market, centred on the Sahara',
    ).toBe('556');
  });

  it('is the city of the meetup on screen', () => {
    expect(
      cityCodeInView([
        ...SHELL,
        onPage('/$locale/$market/e/$slug', { event: { cityCode: '891' } }),
      ]),
    ).toBe('891');
  });

  it('is the city the wizard is already open on, and none when it is open on the market', () => {
    expect(
      cityCodeInView([
        ...SHELL,
        onPage('/$locale/$market/host/create', { city: { code: '556' } }),
      ]),
    ).toBe('556');
    expect(
      cityCodeInView([
        ...SHELL,
        onPage('/$locale/$market/host/create', { city: null }),
      ]),
    ).toBeUndefined();
  });

  it('reaches both of the site’s Host links from the root document', () => {
    expect(rootDocument).toContain('useMatches({ select: cityCodeInView })');
    for (const link of ['Navbar', 'Footer'])
      expect(
        new RegExp(`<${link}[^>]*cityCode=\\{cityCode\\}`, 'u').test(
          rootDocument,
        ),
        `the ${link}'s Host link was left opening the wizard on the whole market`,
      ).toBe(true);
  });

  it('is none on a page about no city, or on a city page still loading', () => {
    expect(
      cityCodeInView([...SHELL, onPage('/$locale/$market/', {})]),
    ).toBeUndefined();
    expect(
      cityCodeInView([...SHELL, onPage('/$locale/$market/$city')]),
    ).toBeUndefined();
  });
});

describe('which pages are a task nothing unasked opens over', () => {
  it.each(TASKS)('includes %s', (_task, route) => {
    expect(
      route.options.staticData?.isFocusedTask,
      'the install sheet would cover a code field or a form’s last button',
    ).toBe(true);
  });

  it('holds the install sheet back only while such a page is on screen', () => {
    expect(
      isFocusedTask([
        { staticData: {} },
        { staticData: { isFocusedTask: true } },
      ]),
    ).toBe(true);
    expect(isFocusedTask([{ staticData: {} }])).toBe(false);
  });

  it('reaches the install sheet and its head script from the root document', () => {
    expect(rootDocument).toContain('useMatches({ select: isFocusedTask })');
    expect(rootDocument).toContain(
      '<InstallPrompt locale={locale} canShow={!isOnFocusedTask} />',
    );
    expect(
      rootDocument,
      'without the head script, Chrome’s announcement can come before the app listens for it',
    ).toContain('{ children: installCaptureScript() }');
  });
});
