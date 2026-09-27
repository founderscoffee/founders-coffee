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
  it('puts the start where an Arabic reader starts, on the right', () => {
    const input = show('ar');

    expect(input.value).toBe('18:00 - 19:00');
    expect(
      input.getAttribute('dir'),
      'held left to right, 18:00 sat on the left, so a host reading right to left met 19:00 first and read the range as reversed; right to left, the two numeral runs keep their digits and 18:00 lands on the right',
    ).toBe('rtl');
  });

  it('reads left to right on a left-to-right page', () => {
    const input = show('en');

    expect(input.getAttribute('dir')).toBe('ltr');
  });
});
