import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import {
  how_step1_title,
  how_step2_title,
  how_step3_title,
} from '@founders-coffee/i18n';

import { HowItWorks } from './HowItWorks';

afterEach(cleanup);

const show = (locale: 'ar' | 'fr' | 'en' = 'fr') =>
  render(<HowItWorks locale={locale} marketSlug="algeria" />);

const hrefs = () =>
  screen.getAllByRole('link').map((link) => link.getAttribute('href') ?? '');

describe('the how-it-works section', () => {
  it('walks the reader through all three steps in order', () => {
    show('fr');
    const steps = screen.getAllByRole('listitem');

    expect(steps).toHaveLength(3);
    for (const [index, title] of [
      how_step1_title,
      how_step2_title,
      how_step3_title,
    ].entries())
      expect(steps[index]?.textContent).toContain(title({}, { locale: 'fr' }));
  });

  it('leaves the illustrations out of the accessibility tree', () => {
    const { container } = show('fr');
    const images = [...container.querySelectorAll('img')];

    expect(images).toHaveLength(3);
    for (const image of images)
      expect(
        image.getAttribute('alt'),
        'the step heading already carries the meaning, so any alt would read it to a screen reader twice',
      ).toBe('');
    expect(
      screen.queryAllByRole('img'),
      'an empty alt takes the image out of the accessibility tree, which is the point',
    ).toHaveLength(0);
  });

  it('surfaces the FAQ that was otherwise only reachable from the footer', () => {
    show('fr');

    expect(hrefs()).toContain('/fr/faq');
    expect(
      hrefs(),
      'the unprefixed company path answers 307 to its prefixed form before it renders',
    ).not.toContain('/faq');
  });

  it('sends a would-be host to the wizard in their own language', () => {
    show('fr');

    expect(hrefs()).toContain('/fr/algeria/host/create');
    expect(hrefs()).not.toContain('/algeria/host/create');
  });

  it('follows the reader into Arabic', () => {
    show('ar');

    expect(hrefs()).toContain('/ar/faq');
    expect(hrefs()).toContain('/ar/algeria/host/create');
  });

  it('names the section for a reader skipping by heading', () => {
    show('en');

    expect(
      screen.getByRole('region', { name: /how a meetup happens/iu }),
    ).toBeTruthy();
  });
});
