import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UserProfile } from '../api';
import { ProfileForm } from './ProfileForm';

const state = vi.hoisted(() => ({
  save: vi.fn(),
  reset: vi.fn(),
  refetch: vi.fn(),
  config: {
    data: {
      isTurnstileBypassed: true,
      turnstileSiteKey: null as string | null,
    },
    isError: false,
  },
}));

vi.mock('../hooks', () => ({
  useUpdateProfile: () => ({
    mutateAsync: state.save,
    reset: state.reset,
    isPending: false,
    isSuccess: false,
  }),
}));
vi.mock('../../auth/hooks', () => ({
  usePublicAuthConfig: () => ({ ...state.config, refetch: state.refetch }),
}));

const saved: UserProfile = {
  userId: 'usr_1',
  displayName: 'Amina',
  revision: 4,
  photoAssetId: null,
  introduction: null,
  introductionLocale: null,
  communityRole: null,
  interests: [],
  spokenLanguages: [],
  professionalLink: null,
  visibility: {
    photo: false,
    introduction: false,
    communityRole: false,
    interests: false,
    spokenLanguages: false,
    professionalLink: false,
  },
};

const show = (profile: UserProfile = saved) =>
  render(
    <ProfileForm profile={profile} locale="en" onReload={state.refetch} />,
  );
const role = () => screen.getByLabelText('I would describe myself as');
const intro = () => screen.getByLabelText('A short introduction');
const preview = () => screen.getByLabelText('Public preview');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('PF-04b optional fields', () => {
  it('offers the role enum as a select, never as free text', () => {
    show();
    const options = Array.from(role().querySelectorAll('option')).map(
      (option) => option.getAttribute('value'),
    );

    expect(role().tagName).toBe('SELECT');
    expect(options).toEqual([
      '',
      'founder',
      'aspiring_founder',
      'developer',
      'designer',
      'community_builder',
      'other',
    ]);
  });

  it('keeps a publication switch unusable until its field has something in it', () => {
    show();
    const introSwitch = screen.getByLabelText(
      'Show publicly — A short introduction',
    ) as HTMLInputElement;
    expect(introSwitch.disabled).toBe(true);

    fireEvent.change(intro(), { target: { value: 'Building small tools.' } });
    expect(
      (
        screen.getByLabelText(
          'Show publicly — A short introduction',
        ) as HTMLInputElement
      ).disabled,
    ).toBe(false);
  });

  it('shows the owner a detail that the public preview withholds until published', () => {
    show();
    fireEvent.change(intro(), { target: { value: 'Building small tools.' } });

    expect((intro() as HTMLTextAreaElement).value).toBe(
      'Building small tools.',
    );
    expect(preview().textContent).not.toContain('Building small tools.');

    fireEvent.click(
      screen.getByLabelText('Show publicly — A short introduction'),
    );

    expect(preview().textContent).toContain('Building small tools.');
  });

  it('stops a sixth topic without unselecting one the member chose', () => {
    show();
    const topics = [
      'Bootstrapping',
      'Product',
      'Design',
      'Engineering',
      'Finding customers',
    ];
    for (const topic of topics) {
      fireEvent.click(screen.getByRole('button', { name: topic }));
    }
    const sixth = screen.getByRole('button', {
      name: 'Community',
    }) as HTMLButtonElement;

    expect(sixth.disabled).toBe(true);
    for (const topic of topics) {
      expect(
        screen
          .getByRole('button', { name: topic })
          .getAttribute('aria-pressed'),
      ).toBe('true');
    }
  });

  it('discards every edit back to the saved profile', () => {
    show();
    fireEvent.change(intro(), { target: { value: 'A draft nobody kept.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Design' }));

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect((intro() as HTMLTextAreaElement).value).toBe('');
    expect(
      screen
        .getByRole('button', { name: 'Design' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(state.save).not.toHaveBeenCalled();
  });

  it('sends the normalized command with the revision it was editing', async () => {
    state.save.mockResolvedValue({
      ...saved,
      revision: 5,
      communityRole: 'founder',
    });
    show();
    fireEvent.change(role(), { target: { value: 'founder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => expect(state.save).toHaveBeenCalled());

    expect(state.save).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          displayName: 'Amina',
          expectedRevision: 4,
          communityRole: 'founder',
        }),
      }),
    );
  });

  it('refuses a link that is not a credential-free https address', () => {
    show();
    fireEvent.change(screen.getByLabelText('A link about your work'), {
      target: { value: 'http://insecure.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('alert').textContent).toContain('https://');
    expect(state.save).not.toHaveBeenCalled();
  });
});
