import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  account_language_error,
  account_language_saved,
} from '@founders-coffee/i18n';

import { LanguageGroup } from './LanguageGroup';

const EN = { locale: 'en' } as const;

const group = (
  overrides: Partial<Parameters<typeof LanguageGroup>[0]> = {},
) => (
  <LanguageGroup
    locale="en"
    value="en"
    isDirty={false}
    isPending={false}
    isError={false}
    isSuccess={false}
    onChange={vi.fn()}
    onReset={vi.fn()}
    onSave={vi.fn()}
    {...overrides}
  />
);

afterEach(cleanup);

describe('LanguageGroup', () => {
  it('confirms a saved language in the region that was waiting for it', () => {
    const { rerender } = render(group({ isDirty: true }));
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');

    rerender(group({ isSuccess: true }));

    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe(account_language_saved({}, EN));
    expect(region.className).toContain('alert-success');
  });

  it('reports a failed save as an error', () => {
    const { rerender } = render(group({ isDirty: true }));
    const region = screen.getByRole('alert');

    rerender(group({ isDirty: true, isError: true }));

    expect(screen.getByRole('alert')).toBe(region);
    expect(region.textContent).toBe(account_language_error({}, EN));
    expect(region.className).toContain('alert-error');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('says nothing while a change is waiting to be saved', () => {
    render(group({ isDirty: true, isSuccess: true }));

    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('alert').textContent).toBe('');
  });
});
