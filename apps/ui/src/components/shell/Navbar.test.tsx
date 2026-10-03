import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    'aria-label': label,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    'aria-label'?: string;
  }) => (
    <a
      href={`${Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}${search ? `?${new URLSearchParams(search)}` : ''}`}
      aria-label={label}
    >
      {children}
    </a>
  ),
}));

vi.mock('./ProfileMenuDrawer', () => ({ ProfileMenuDrawer: () => null }));
vi.mock('./SessionNav', () => ({ SessionNav: () => null }));
vi.mock('./OfflineNotice', () => ({ OfflineNotice: () => null }));

const { Navbar } = await import('./Navbar');

const header = (isHiddenOnMobile?: boolean) =>
  render(
    <Navbar
      locale="en"
      marketSlug="algeria"
      isHiddenOnMobile={isHiddenOnMobile}
    />,
  ).container.querySelector('header')?.className ?? '';

afterEach(cleanup);

describe('the site header', () => {
  it('stays on every width by default', () => {
    expect(header()).not.toContain('hidden');
  });

  it('gives way below lg to a page that draws its own', () => {
    const className = header(true);

    expect(className).toContain('max-lg:hidden');
    expect(className).not.toMatch(/(^|\s)hidden(\s|$)/u);
  });

  it('puts sign-in before the host button, which ends the row', () => {
    const { container, getByRole } = render(
      <Navbar locale="en" marketSlug="algeria" />,
    );
    const slot = container.querySelector('.auth-slot');
    const host = getByRole('link', { name: 'Host a meetup' });

    expect(slot).not.toBeNull();
    expect(
      slot?.compareDocumentPosition(host),
      'the markup is the order a signed-out visitor sees and tabs through; only the signed-in avatar is moved, by the stylesheet',
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('opens the wizard on the city the reader is looking at', () => {
    const { getByRole } = render(
      <Navbar locale="en" marketSlug="algeria" cityCode="556" />,
    );

    expect(
      getByRole('link', { name: 'Host a meetup' }).getAttribute('href'),
      'from Algiers’ page the wizard opened on the whole market and asked the host where they were',
    ).toBe('/en/algeria/host/create?city=556');
  });

  it('opens the wizard on the market from a page about no city', () => {
    const { getByRole } = render(<Navbar locale="en" marketSlug="algeria" />);

    expect(
      getByRole('link', { name: 'Host a meetup' }).getAttribute('href'),
    ).toBe('/en/algeria/host/create');
  });

  it.each([
    ['en', 'Host', 'Host a meetup'],
    ['fr', 'Organiser', 'Organiser une rencontre'],
    ['ar', 'استضف لقاء', 'استضف لقاء'],
  ] as const)(
    'shows the short host label in %s and keeps the whole phrase as its name',
    (locale, shown, name) => {
      const { getByRole } = render(
        <Navbar locale={locale} marketSlug="algeria" />,
      );

      expect(
        getByRole('link', { name }).textContent,
        'a link read out as just "Host" says nothing of what it hosts; the visible label starts the name, so a voice command naming it still works',
      ).toBe(shown);
    },
  );
});
