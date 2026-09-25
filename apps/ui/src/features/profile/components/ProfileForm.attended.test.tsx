import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { savedProfile } from '../profile.fixtures';
import { ProfileForm } from './ProfileForm';

const state = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock('../hooks', () => ({
  useUpdateProfile: () => ({
    mutateAsync: state.save,
    reset: vi.fn(),
    isPending: false,
  }),
  usePhotoUploadAvailability: () => ({ data: { enabled: false } }),
  usePhotoUpload: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemovePhoto: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const toggle = () =>
  screen.getByLabelText(
    'Show publicly: Meetups I attended',
  ) as HTMLInputElement;

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('the profile form offers the attended count, off (#90)', () => {
  it('starts private, says what is counted, and can be turned on with nothing filled in', async () => {
    state.save.mockResolvedValue({ ...savedProfile, revision: 5 });
    render(
      <ProfileForm profile={savedProfile} locale="en" onReload={vi.fn()} />,
    );

    expect(toggle().checked).toBe(false);
    expect(toggle().disabled).toBe(false);
    expect(
      screen.getByText(/Meetups you missed are not counted or shown\./),
    ).toBeTruthy();

    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await vi.waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.save.mock.calls[0]?.[0].profile.visibility).toMatchObject({
      attendedCount: true,
      interests: false,
    });
  });

  it('discards the choice with every other unsaved edit', () => {
    render(
      <ProfileForm profile={savedProfile} locale="en" onReload={vi.fn()} />,
    );
    fireEvent.click(toggle());

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(toggle().checked).toBe(false);
  });
});
