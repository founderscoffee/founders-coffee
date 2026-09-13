import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { CloseoutRoster, ROSTER_VIRTUAL_THRESHOLD } from './CloseoutRoster';
import type { Mark } from '../draft';

const roster = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    userId: `usr_${index}`,
    name: `Member ${index}`,
    outcome: null,
  }));

const show = (
  count: number,
  {
    marks = {},
    onMark = vi.fn(),
    locale = 'en' as Locale,
  }: {
    marks?: Record<string, Mark>;
    onMark?: (userId: string, outcome: Mark) => void;
    locale?: Locale;
  } = {},
) => {
  render(
    <CloseoutRoster
      locale={locale}
      marks={marks}
      onMark={onMark}
      roster={roster(count)}
    />,
  );
  return onMark;
};

const rows = () => screen.getAllByRole('listitem');

const first = <T,>(items: readonly T[]): T => {
  const item = items[0];
  if (item === undefined) throw new Error('Expected a rendered radio');
  return item;
};

const givePageALayout = (height: number) => {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight',
  );
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => height,
  });
  return () => {
    if (original)
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
    else
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a roster a café table could hold', () => {
  it('renders every person, because a dozen rows cost nothing', () => {
    show(12);

    expect(rows()).toHaveLength(12);
    expect(screen.getByText('Member 11')).toBeTruthy();
  });

  it('marks the person whose row was clicked', () => {
    const onMark = show(12);

    fireEvent.click(
      first(screen.getAllByRole('radio', { name: /^Came$/i }).slice(3, 4)),
    );

    expect(onMark).toHaveBeenCalledWith('usr_3', 'attended');
  });

  it('shows what the draft already recorded, not what the inputs remember', () => {
    show(12, { marks: { usr_2: 'no_show' } });

    expect(
      (
        screen.getAllByRole('radio', {
          name: /^Did not come$/i,
        })[2] as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('renders the marks in the host’s language', () => {
    show(3, { locale: 'ar' });

    expect(screen.getAllByRole('radio', { name: 'حضر' })).toHaveLength(3);
  });
});

describe('a roster the domain still allows but a page cannot hold', () => {
  let restoreLayout = () => undefined as void;

  beforeEach(() => {
    restoreLayout = givePageALayout(384);
  });

  afterEach(() => restoreLayout());

  it('renders a small window of a two-hundred-person list', () => {
    show(200);

    expect(rows().length).toBeGreaterThan(1);
    expect(rows().length).toBeLessThan(ROSTER_VIRTUAL_THRESHOLD);
    expect(screen.queryByText('Member 199')).toBeNull();
  });

  it('starts at the top of the roster rather than nowhere', () => {
    show(200);

    expect(screen.getByText('Member 0')).toBeTruthy();
  });

  it('still marks the right person from inside the window', () => {
    const onMark = show(200);

    fireEvent.click(first(screen.getAllByRole('radio', { name: /^Came$/i })));

    expect(onMark).toHaveBeenCalledWith('usr_0', 'attended');
  });

  it('keeps a mark on a rendered row that the draft holds', () => {
    show(200, { marks: { usr_0: 'attended' } });

    expect(
      (screen.getAllByRole('radio', { name: /^Came$/i })[0] as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it('leaves the list plain right up to the threshold', () => {
    show(ROSTER_VIRTUAL_THRESHOLD);

    expect(rows()).toHaveLength(ROSTER_VIRTUAL_THRESHOLD);
  });
});
