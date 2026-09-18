import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  classifyPath,
  COMPANY_PAGES,
  defaultAlternateHref,
  soleAlternateLocale,
  withLocale,
} from './routes.mjs';

const alternate = (locale, href) =>
  `<link rel="alternate" hrefLang="${locale}" href="${href}"/>`;

const published = (locales, path) =>
  [
    ...locales.map((locale) => alternate(locale, `https://x/${locale}${path}`)),
    alternate('x-default', `https://x/${locales[0]}${path}`),
  ].join('');

describe('telling one kind of route from another', () => {
  it.each([
    ['/fr/terms', 'company'],
    ['/ar/faq', 'company'],
    ['/en/legal', 'company'],
    ['/fr/community', 'company'],
    ['/ar/organizers', 'company'],
    ['/fr/algeria', 'market'],
    ['/fr/algeria/algiers', 'city'],
    ['/fr/algeria/e/coffee-and-code', 'event'],
    ['/fr/algeria/host/create', 'utility'],
  ])('reads %s as a %s route', (path, type) => {
    expect(classifyPath(path)).toBe(type);
  });

  it('leaves a path with no locale in front uncovered', () => {
    expect(classifyPath('/algeria')).toBeNull();
  });
});

describe('a document published in one language only', () => {
  it('names that language when it advertises no other', () => {
    expect(soleAlternateLocale(published(['ar'], '/terms'))).toBe('ar');
  });

  it('names none when the same page exists in all three', () => {
    expect(soleAlternateLocale(published(['ar', 'fr', 'en'], '/about'))).toBe(
      null,
    );
  });

  it('names none when the document advertises nothing at all', () => {
    expect(soleAlternateLocale('<html><head></head></html>')).toBe(null);
  });

  it('sends every address to the one language it is written in', () => {
    expect(withLocale('/fr/terms', 'ar')).toBe('/ar/terms');
    expect(defaultAlternateHref(published(['ar'], '/terms'))).toBe(
      'https://x/ar/terms',
    );
  });

  it('leaves a path that carries no locale where it is', () => {
    expect(withLocale('/terms', 'ar')).toBe('/terms');
  });
});

const REGISTRY = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../apps/ui/src/content/company/pages.ts',
);

/**
 * The page keys the application itself publishes, read out of its registry.
 *
 * Read from the source rather than imported: the registry is TypeScript inside another Nx
 * project, and a relative import across that boundary is what the lint rules forbid. What
 * matters here is only the set of names.
 */
const registryPages = () => {
  const source = readFileSync(REGISTRY, 'utf8');
  const body = source.slice(source.indexOf('export const COMPANY_PAGES = {'));
  return [...body.matchAll(/^ {2}([a-z]+): \{$/gmu)].map((match) => match[1]);
};

describe('the pages the smoke is told about', () => {
  it('finds the registry it is comparing against', () => {
    expect(registryPages().length).toBeGreaterThan(4);
  });

  it('holds every company page the application publishes, and no other', () => {
    expect([...COMPANY_PAGES].sort()).toEqual(registryPages().sort());
  });
});
