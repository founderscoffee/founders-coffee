import { cleanup, render, screen, within } from '@testing-library/react';
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

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock('../../features/account/hooks', () => ({
  useUpdateAccountLocale: () => ({ mutateAsync: () => Promise.resolve() }),
}));

import {
  footer_about,
  footer_company,
  footer_contact,
  footer_faq,
  footer_source,
  footer_tagline,
} from '@founders-coffee/i18n';

import { SOURCE_REPOSITORY_URL } from '../../lib/source-repository';

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
    const links = hrefs().filter((href) => href !== SOURCE_REPOSITORY_URL);
    expect(links.length).toBeGreaterThan(0);
    for (const href of links)
      expect(
        href,
        'every destination the footer names on this site has a localized form, so the only link it excuses is the source code, which GitHub serves in one language',
      ).toMatch(/^\/fr\//u);
  });

  it.each<['ar' | 'fr' | 'en', string]>([
    ['ar', 'الشيفرة المصدرية'],
    ['fr', 'Code source'],
    ['en', 'Source code'],
  ])(
    'offers the %s reader the source code, at the repository',
    (locale, label) => {
      renderFooter(locale);

      expect(
        screen
          .getAllByRole('link', { name: label })
          .map((link) => link.getAttribute('href')),
        'the AGPL has the site offer everyone who uses it the source it runs, so the footer under every page links the repository at both breakpoints',
      ).toEqual([SOURCE_REPOSITORY_URL, SOURCE_REPOSITORY_URL]);
    },
  );

  it('lists the source code after the company links, dressed as they are', () => {
    renderFooter('en');
    const groups = screen.getAllByRole('navigation', {
      name: footer_company({}, { locale: 'en' }),
    });

    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const links = within(group).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(
        [footer_about, footer_faq, footer_contact, footer_source].map((label) =>
          label({}, { locale: 'en' }),
        ),
      );
      expect(
        links.at(-1)?.className,
        'the source code is one more footer link, not a badge that outshouts the pages beside it',
      ).toBe(links[0]?.className);
    }
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

  it('keeps its column labels out of the page outline', () => {
    renderFooter('ar');

    expect(
      screen.queryAllByRole('heading').map((node) => node.textContent),
      "the footer renders under every page, so a heading here joins somebody else's outline: a reader moving by headings leaves the article and lands in the site map without being told they have",
    ).toEqual([]);
  });

  it('still gives each column group a name to be announced by', () => {
    const view = renderFooter('ar');
    const groups = [...view.container.querySelectorAll('nav[aria-labelledby]')];

    expect(
      groups.length,
      'no labelled group was found, so the assertion below reads nothing',
    ).toBeGreaterThan(0);
    for (const group of groups) {
      const label = view.container.querySelector(
        `#${group.getAttribute('aria-labelledby') ?? ''}`,
      );
      expect(
        label?.textContent?.trim(),
        'dropping the heading has to cost the group nothing: the element it is named by still has to exist and still has to say something',
      ).toBeTruthy();
    }
  });
});
