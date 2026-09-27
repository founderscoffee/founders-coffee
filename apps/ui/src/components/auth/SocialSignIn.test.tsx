import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SocialSignIn, type SocialProvider } from './SocialSignIn';

afterEach(() => cleanup());

const show = (
  providers: readonly SocialProvider[],
  onSelect = vi.fn(),
  isDisabled = false,
) =>
  render(
    <SocialSignIn
      locale="en"
      providers={providers}
      isDisabled={isDisabled}
      onSelect={onSelect}
    />,
  );

describe('the sign-in buttons for other accounts', () => {
  it('draws nothing, not even the divider, while no provider is set up', () => {
    const { container } = show([]);

    expect(container.childElementCount).toBe(0);
  });

  it('offers only the providers it is given', () => {
    show(['google']);

    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Continue with GitHub' }),
      'a GitHub button shown before GitHub was set up failed when pressed',
    ).toBeNull();
    expect(screen.getByText('or')).toBeTruthy();
  });

  it('offers them in the order given', () => {
    show(['google', 'github']);

    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Continue with Google', 'Continue with GitHub']);
  });

  it('says which provider was chosen', () => {
    const onSelect = vi.fn();
    show(['google', 'github'], onSelect);

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with GitHub' }),
    );

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('github');
  });

  it('holds its buttons while another sign-in is under way', () => {
    show(['google'], vi.fn(), true);

    expect(
      screen
        .getByRole('button', { name: 'Continue with Google' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
