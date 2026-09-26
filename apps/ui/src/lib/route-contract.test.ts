import { describe, expect, it } from 'vitest';

type Kind = 'protocol' | 'redirect' | 'unresolved' | 'root' | 'layout';

type Exemption = { readonly kind: Kind; readonly why: string };

const UNPREFIXED: Readonly<Record<string, Exemption>> = {
  '/': {
    kind: 'root',
    why: 'names no market yet, so it has no locale to prefix with; it redirects once a market can be named and renders the chooser when one cannot',
  },

  '/events.json': { kind: 'protocol', why: 'machine-readable feed' },
  '/og/e/$id': {
    kind: 'protocol',
    why: 'an image for link scrapers, which have no language of their own to prefix for; the card is drawn in the language the `l` parameter names, set by the page that publishes the address',
  },
  '/cal/e/$id': {
    kind: 'protocol',
    why: '#21 — a calendar file, or a redirect to Google Calendar, fetched by a calendar app or a download with no language of its own; the `l` parameter names the language of the page the entry links back to',
  },
  '/llms.txt': { kind: 'protocol', why: 'protocol file' },
  '/robots.txt': { kind: 'protocol', why: 'protocol file' },
  '/sitemap.xml': {
    kind: 'protocol',
    why: 'protocol file, and it carries the localised URLs itself',
  },
  '/sw.js': {
    kind: 'protocol',
    why: 'service worker scope, which must sit at the origin root',
  },
  '/.well-known/security.txt': {
    kind: 'protocol',
    why: 'RFC 9116 fixes the path',
  },

  '/about': { kind: 'redirect', why: 'company page stub' },
  '/community': { kind: 'redirect', why: 'company page stub' },
  '/contact': { kind: 'redirect', why: 'company page stub' },
  '/cookies': { kind: 'redirect', why: 'company page stub' },
  '/faq': { kind: 'redirect', why: 'company page stub' },
  '/legal': { kind: 'redirect', why: 'company page stub' },
  '/organizers': { kind: 'redirect', why: 'company page stub' },
  '/privacy': { kind: 'redirect', why: 'company page stub' },
  '/terms': { kind: 'redirect', why: 'company page stub' },
  '/account': {
    kind: 'redirect',
    why: 'legacy address, now under /{locale}/profile',
  },
  '/activity': {
    kind: 'redirect',
    why: 'legacy address, now under /{locale}/profile',
  },
  '/preferences': {
    kind: 'redirect',
    why: 'legacy address, now under /{locale}/profile',
  },
  '/closeout/$eventId': {
    kind: 'redirect',
    why: '8f59f74 — notifications already enqueued carry this address',
  },
  '/feedback/$eventId': {
    kind: 'redirect',
    why: '8f59f74 — notifications already enqueued carry this address',
  },
  '/edit/$eventId': {
    kind: 'redirect',
    why: '#14 — renders nothing; it answers the locale-free address with the prefixed one',
  },

  '/login': {
    kind: 'redirect',
    why: '#58 — the sign-in page is /{locale}/login; this address answers 307 to it',
  },
  '/onboarding': {
    kind: 'redirect',
    why: '#58 — same as /login, behind requireSession',
  },
  '/profile': {
    kind: 'layout',
    why: 'groups the four private screens and renders none of them; each address beneath it carries the language',
  },
  '/profile/': { kind: 'redirect', why: '#58 — now /{locale}/profile' },
  '/profile/account': {
    kind: 'redirect',
    why: '#58 — now /{locale}/profile/account',
  },
  '/profile/activity': {
    kind: 'redirect',
    why: '#58 — now /{locale}/profile/activity',
  },
  '/profile/notifications': {
    kind: 'redirect',
    why: '#58 — now /{locale}/profile/notifications',
  },
  '/u/$userId': {
    kind: 'redirect',
    why: '#58 — the profile is /{locale}/u/$userId; a shared link opens in the language it was shared in',
  },
};

import { declaredRoutes, sourceOf } from './route-contract.fixtures';

/**
 * The routes that carry no locale, which are the only ones `UNPREFIXED` has anything to say about.
 *
 * The four kinds that map records are not interchangeable. `protocol` is a machine-readable file
 * with no reader to serve a language to. `redirect` is a stub that answers 307 to its prefixed form
 * and renders nothing — the addresses already sitting in somebody's inbox, which is why `8f59f74`
 * kept them rather than deleting them. `root` is `/` alone, which names no market yet. `unresolved`
 * is a page that really does render in whatever language the cookie happens to say: a defect with
 * an issue behind it rather than a decision, and the gate makes each one cost a line in that map
 * until it is fixed.
 */
const unprefixed = () =>
  declaredRoutes().filter(({ fullPath }) => !fullPath.startsWith('/$locale'));

describe('the locale contract', () => {
  it('reads the generated tree', () => {
    const routes = declaredRoutes();
    expect(
      routes.length,
      'the generated tree parsed to nothing, so every assertion below is vacuous',
    ).toBeGreaterThan(30);
    expect(routes.every(({ file }) => file !== '')).toBe(true);
  });

  it('prefixes every route, or says in writing why this one cannot be', () => {
    const undeclared = unprefixed()
      .filter(({ fullPath }) => !(fullPath in UNPREFIXED))
      .map(
        ({ fullPath, file }) =>
          `${fullPath} (${file}) carries no locale and is not in UNPREFIXED — prefix it with /$locale, or add an entry saying why it cannot be`,
      );

    expect(undeclared, undeclared.join('\n')).toEqual([]);
  });

  it('holds no exemption for a route that no longer exists', () => {
    const live = new Set(declaredRoutes().map(({ fullPath }) => fullPath));
    for (const fullPath of Object.keys(UNPREFIXED))
      expect(
        live.has(fullPath),
        `${fullPath} is exempted but is no longer a route — delete the entry`,
      ).toBe(true);
  });

  it('gives every exemption a reason, and every unresolved one an issue', () => {
    for (const [fullPath, { kind, why }] of Object.entries(UNPREFIXED)) {
      expect(why.trim(), `${fullPath} is exempted without saying why`).not.toBe(
        '',
      );
      if (kind === 'unresolved')
        expect(
          why,
          `${fullPath} is recorded as an open defect with no issue to close it against`,
        ).toMatch(/#\d+/u);
    }
  });

  /**
   * A stub that grew a component stopped being a stub.
   *
   * These addresses are the ones already printed in notifications and linked from elsewhere, and
   * their whole contract is that they hand the reader to the prefixed page rather than answering in
   * the cookie's language. Rendering anything here would reintroduce `8f59f74` quietly, on a route
   * nobody is looking at, so the shape is asserted rather than trusted.
   */
  /**
   * A layout that grew a page of its own stopped being a layout.
   *
   * `layout` is the one kind that renders something, so it is the one an unprefixed page could
   * hide behind. It earns the exemption only by having nothing of its own to say: no data, no
   * head, and nothing in the tree but the child whose address carries the language.
   */
  it('keeps every layout exemption a layout', () => {
    for (const { fullPath, file } of unprefixed()) {
      if (UNPREFIXED[fullPath]?.kind !== 'layout') continue;
      const body = sourceOf(file);
      expect(body, `${fullPath}: could not read ${file}`).not.toBe('');
      expect(
        body,
        `${fullPath} is exempted as a layout but renders something other than its children`,
      ).toMatch(/component: \(\) => <Outlet \/>/u);
      expect(
        body,
        `${fullPath} is exempted as a layout but loads or titles something of its own`,
      ).not.toMatch(/\b(loader|head):/u);
    }
  });

  it('keeps every redirect stub a redirect', () => {
    for (const { fullPath, file } of unprefixed()) {
      if (UNPREFIXED[fullPath]?.kind !== 'redirect') continue;
      const body = sourceOf(file);
      expect(body, `${fullPath}: could not read ${file}`).not.toBe('');
      expect(
        body,
        `${fullPath} is exempted as a redirect stub but declares a component — it now renders in the cookie's language`,
      ).not.toMatch(/\bcomponent:/u);
      expect(
        body,
        `${fullPath} is exempted as a redirect stub but has no beforeLoad, so nothing sends the reader to the prefixed page`,
      ).toMatch(/\bbeforeLoad\b/u);
    }
  });
});
