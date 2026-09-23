import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { DatetimePicker } from './DatetimePicker';

const SEPTEMBER = Date.UTC(2026, 8, 23, 12);

const dayLabels = (locale: Locale) => {
  const view = render(
    <DatetimePicker
      startsAt={SEPTEMBER}
      endsAt={SEPTEMBER}
      onChange={() => undefined}
      onError={() => undefined}
      locale={locale}
      timeZone="Africa/Algiers"
    />,
  );
  return [...view.container.querySelectorAll('button[aria-label]')]
    .map((button) => button.getAttribute('aria-label') ?? '')
    .filter((label) => /2026/u.test(label));
};

afterEach(() => cleanup());

describe('the language a day button speaks', () => {
  it('reads the calendar out in the language the page is in', () => {
    const labels = dayLabels('ar');

    expect(labels.length).toBeGreaterThan(0);
    expect(
      labels.every((label) => /[؀-ۿ]/u.test(label)),
      'the picker is handed a locale per reader, so an Arabic page must not hear its days named in another language',
    ).toBe(true);
    expect(labels.some((label) => /,/u.test(label))).toBe(false);
  });

  it('still reads it out in English to an English page', () => {
    const labels = dayLabels('en');

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => /^[\x20-\x7E]+$/u.test(label))).toBe(true);
  });
});
