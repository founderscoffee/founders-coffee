import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  profile_load_error,
  profile_loading,
  profile_reload,
} from '@founders-coffee/i18n';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const { ProfileAccess } = await import('./ProfileAccess');

const EN = { locale: 'en' } as const;

afterEach(cleanup);

describe('ProfileAccess', () => {
  it('waits with a spinner beside the words', () => {
    render(
      <ProfileAccess
        locale="en"
        isLoading
        isAnonymous={false}
        returnPath="/en/profile"
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe(
      profile_loading({}, EN),
    );
    expect(
      screen.getByRole('status').querySelector('.loading-spinner'),
    ).not.toBeNull();
  });

  it('reports a profile that would not load as an error, with the retry inside it', () => {
    const onRetry = vi.fn();
    render(
      <ProfileAccess
        locale="en"
        isLoading={false}
        isAnonymous={false}
        returnPath="/en/profile"
        onRetry={onRetry}
      />,
    );

    const failure = screen.getByRole('alert');
    expect(failure.className).toContain('alert-error');
    expect(failure.textContent).toContain(profile_load_error({}, EN));

    fireEvent.click(
      screen.getByRole('button', { name: profile_reload({}, EN) }),
    );
    expect(onRetry).toHaveBeenCalledOnce();
    expect(failure.contains(screen.getByRole('button'))).toBe(true);
  });
});
