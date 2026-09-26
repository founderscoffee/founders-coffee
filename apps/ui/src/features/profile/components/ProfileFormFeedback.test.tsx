import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { savedProfile } from '../profile.fixtures';
import { ProfileForm } from './ProfileForm';

const state = vi.hoisted(() => ({
  save: vi.fn(),
  reload: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useUpdateProfile: () => ({
    mutateAsync: state.save,
    isPending: false,
    reset: () => undefined,
  }),
  usePhotoUploadAvailability: () => ({ data: { enabled: false } }),
}));

const show = () =>
  render(
    <ProfileForm profile={savedProfile} locale="en" onReload={state.reload} />,
  );
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('profile form action feedback', () => {
  it('keeps edits after failure, allows dismissal, and replaces errors on a successful retry', async () => {
    state.save.mockRejectedValueOnce({ code: 'profile_conflict' });
    show();
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Edited name' },
    });
    save();
    const error = await screen.findByRole('alert');
    expect(error.className).toContain('alert-error');
    expect(error.closest('.toast')).not.toBeNull();
    expect(
      (screen.getByLabelText('Display name') as HTMLInputElement).value,
    ).toBe('Edited name');
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reload your profile' }),
    ).toBeTruthy();
    state.save.mockResolvedValue({
      ...savedProfile,
      displayName: 'Edited name',
      revision: 5,
    });
    save();
    expect((await screen.findByRole('status')).className).toContain(
      'alert-success',
    );
    expect(
      screen.queryByRole('button', { name: 'Reload your profile' }),
    ).toBeNull();
  });

  it.each([undefined, new Error('offline')])(
    'reports reload failures without losing the draft (%s)',
    async (failure) => {
      state.save.mockRejectedValue({ code: 'profile_conflict' });
      if (failure) state.reload.mockRejectedValue(failure);
      else state.reload.mockResolvedValue(undefined);
      show();
      save();
      await screen.findByRole('alert');
      fireEvent.click(
        screen.getByRole('button', { name: 'Reload your profile' }),
      );
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain('Could not'),
      );
      expect(screen.getByRole('alert').closest('.toast')).not.toBeNull();
    },
  );
});
