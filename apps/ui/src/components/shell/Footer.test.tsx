import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    hash,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    hash?: string;
    children: React.ReactNode;
  }) => (
    <a
      href={`${Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}${hash ? `#${hash}` : ''}`}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import { footer_tagline } from '@founders-coffee/i18n';

import { Footer } from './Footer';

const MARKET = {
  code: 'DZ',
  slug: 'algeria',
  name: 'Algeria',
  nameAr: 'الجزائر',
  nameFr: 'Algérie',
};

const hrefs = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href') ?? '')
    .filter((href, index, all) => all.indexOf(href) === index);

const renderFooter = (locale: 'ar' | 'fr' | 'en' = 'fr') =>
  render(<Footer locale={locale} markets={[MARKET]} market={MARKET} />);

const timesLinked = (href: string) =>
  screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href') === href).length;

afterEach(cleanup);

describe('the footer', () => {
  it('carries the reader a language on every link it has', () => {
    renderFooter('fr');
    const links = hrefs();
    expect(links.length).toBeGreaterThan(0);
    for (const href of links)
      expect(
        href,
        'every destination the footer names has a localized form now that the activity link has moved to the session menu, so there is nothing left to excuse',
      ).toMatch(/^\/fr\//u);
  });

  it('follows the reader into Arabic', () => {
    renderFooter('ar');
    expect(hrefs()).toContain('/ar/terms');
    expect(hrefs()).toContain('/ar/algeria');
  });

  it('sends nobody through a redirect to reach the terms', () => {
    renderFooter('fr');
    expect(hrefs()).not.toContain('/terms');
    expect(hrefs()).not.toContain('/about');
  });

  it('sends nobody through the root redirect to reach home', () => {
    renderFooter('fr');
    expect(
      hrefs(),
      'linking the brand mark at `/` spends a geo lookup, a market lookup and a 307 to arrive where the footer was already able to name',
    ).not.toContain('/');
  });

  it('still renders each nav link at both breakpoints', () => {
    renderFooter('fr');
    expect(timesLinked('/fr/terms')).toBe(2);
  });

  it('sends a French reader to the French host wizard', () => {
    renderFooter('fr');
    expect(hrefs()).toContain('/fr/algeria/host/create');
    expect(hrefs()).not.toContain('/algeria/host/create');
  });

  it('leaves the signed-in destinations to the session menu', () => {
    renderFooter('fr');

    expect(
      hrefs(),
      'the activity page bounces a signed-out reader to login, and the footer is on every public page — it belongs behind the avatar, where only somebody with a session sees it',
    ).not.toContain('/profile/activity');
  });

  it('opens the contact page on the reporting section, not at its top', () => {
    renderFooter('fr');

    expect(
      hrefs(),
      'a reader who clicks report a problem and lands on general support has to hunt for the part they came for, and the generated section ids are built from the translated heading so only a declared anchor survives the locale',
    ).toContain('/fr/contact#report');
  });

  it.each<['ar' | 'fr' | 'en', string]>([
    ['ar', 'الجزائر'],
    ['fr', 'Algérie'],
    ['en', 'Algeria'],
  ])('calls the market by its %s name in the tagline', (locale, name) => {
    renderFooter(locale);

    expect(
      screen.getByText(footer_tagline({ market: name }, { locale })),
      `the ${locale} footer calls the market something other than ${name}`,
    ).toBeTruthy();
  });
});
