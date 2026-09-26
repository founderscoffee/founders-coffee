import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
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
    const { container, getByText } = render(
      <Navbar locale="en" marketSlug="algeria" />,
    );
    const slot = container.querySelector('.auth-slot');
    const host = getByText('Host a meetup');

    expect(slot).not.toBeNull();
    expect(
      slot?.compareDocumentPosition(host),
      'the markup is the order a signed-out visitor sees and tabs through; only the signed-in avatar is moved, by the stylesheet',
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
