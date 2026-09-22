import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('timepicker-ui', () => ({
  PluginRegistry: { register: vi.fn() },
  TimepickerUI: class {
    create = vi.fn();
    destroy = vi.fn();
    on = vi.fn();
    managers = { plugins: {} };
  },
}));

vi.mock('timepicker-ui/plugins/range', () => ({ RangePlugin: {} }));

const { TimePicker } = await import('./TimePicker');

const show = (locale: 'ar' | 'en' = 'ar') => {
  const view = render(
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <TimePicker
        from="18:00"
        to="19:00"
        onChange={() => undefined}
        locale={locale}
      />
    </div>,
  );
  return view.container.querySelector('input') as HTMLInputElement;
};

afterEach(() => cleanup());

describe('a clock range inside an Arabic page', () => {
  it('reads start then end, and says so in its own direction', () => {
    const input = show('ar');

    expect(input.value).toBe('18:00 - 19:00');
    expect(
      input.getAttribute('dir'),
      'the value was always right; an RTL paragraph reorders the two numeral runs around the hyphen, so a host setting 18:00 to 19:00 read 19:00 to 18:00 and concluded the form was broken',
    ).toBe('ltr');
  });

  it('carries the same direction in a page that is already left to right', () => {
    const input = show('en');

    expect(
      input.getAttribute('dir'),
      'a clock range is left to right in every language, so this is not a translation of the page direction',
    ).toBe('ltr');
  });
});
