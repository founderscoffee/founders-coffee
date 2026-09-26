import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  profile_languages_label,
  profile_photo_card_subtitle,
  type Locale,
} from '@founders-coffee/i18n';

import type { UserProfile } from '../api';
import { savedProfile as saved } from '../profile.fixtures';
import { ProfileForm } from './ProfileForm';

const state = vi.hoisted(() => ({
  save: vi.fn(),
  reset: vi.fn(),
  refetch: vi.fn(),
  upload: vi.fn(),
  removePhoto: vi.fn(),
  photos: { enabled: false } as { enabled: boolean } | undefined,
}));

vi.mock('../hooks', () => ({
  useUpdateProfile: () => ({
    mutateAsync: state.save,
    reset: state.reset,
    isPending: false,
    isSuccess: false,
  }),
  usePhotoUploadAvailability: () => ({ data: state.photos }),
  usePhotoUpload: () => ({ mutateAsync: state.upload, isPending: false }),
  useRemovePhoto: () => ({ mutateAsync: state.removePhoto, isPending: false }),
}));

const show = (profile: UserProfile = saved) =>
  render(
    <ProfileForm profile={profile} locale="en" onReload={state.refetch} />,
  );
const intro = () => screen.getByLabelText('About you');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  state.photos = { enabled: false };
});

describe('PF-06 simplified photo card', () => {
  it.each<Locale>(['ar', 'fr', 'en'])(
    'shows only image guidance above the controls in %s',
    (locale) => {
      state.photos = { enabled: true };
      const { container } = render(
        <ProfileForm
          profile={{ ...saved, photoAssetId: 'pha_test' }}
          locale={locale}
          onReload={state.refetch}
        />,
      );
      const card = container.querySelector('section');
      expect(card?.querySelector('h2')).toBeNull();
      expect(card?.querySelector('p')?.textContent).toBe(
        profile_photo_card_subtitle({}, { locale }),
      );
      expect(card?.querySelectorAll('input[type="checkbox"]')).toHaveLength(6);
      expect(card?.querySelector('img')).not.toBeNull();
      expect(card?.querySelector('#profile-name')).not.toBeNull();
      expect(card?.querySelector('#profile-intro')).not.toBeNull();
      expect(card?.querySelector('select')).toBeNull();
      expect(card?.querySelector('#profile-link')).not.toBeNull();
      expect(container.querySelectorAll('form section')).toHaveLength(1);
      expect(container.querySelector('aside')).toBeNull();
      expect(card?.className.split(' ')).not.toContain('border');
      expect(card?.className).not.toContain('border-base-300');
      expect(container.querySelector('form')?.className).not.toContain(
        'grid-cols',
      );
    },
  );
});

describe('PF-04b optional fields', () => {
  it.each([
    ['ar', ['شركاء مؤسسون', 'الشراكات', 'تبادل الخبرات', 'تعلّم مهارات جديدة']],
    [
      'fr',
      [
        'Co-fondateurs',
        'Partenariats',
        'Partage d’expérience',
        'Apprendre de nouvelles compétences',
      ],
    ],
    [
      'en',
      [
        'Co-founders',
        'Partnerships',
        'Experience sharing',
        'Learning new skills',
      ],
    ],
  ] as const)(
    'offers collaboration and learning interests in %s without the language hint',
    (locale, labels) => {
      render(
        <ProfileForm
          profile={saved}
          locale={locale}
          onReload={state.refetch}
        />,
      );
      for (const name of labels) {
        const button = screen.getByRole('button', { name });
        fireEvent.click(button);
        expect(button.getAttribute('aria-pressed')).toBe('true');
      }
      const languageGroup = screen.getByRole('group', {
        name: profile_languages_label({}, { locale }),
      });
      expect(languageGroup.parentElement?.querySelector('p')).toBeNull();
    },
  );
  it('offers investing, development, building and idea interests', () => {
    show();
    for (const name of [
      'Investing',
      'Software development',
      'Product development',
      'Validating ideas',
    ]) {
      const button = screen.getByRole('button', { name });
      fireEvent.click(button);
      expect(button.getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('allows selection and deselection of all six spoken languages', () => {
    show();
    const languages = [
      'Arabic',
      'French',
      'English',
      'Spanish',
      'German',
      'Tamazight',
    ];
    for (const name of languages)
      fireEvent.click(screen.getByRole('button', { name }));
    fireEvent.click(screen.getByLabelText('Show publicly: Languages'));
    for (const name of languages) {
      expect(
        screen.getByRole('button', { name }).getAttribute('aria-pressed'),
      ).toBe('true');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));
    expect(
      screen
        .getByRole('button', { name: 'Spanish' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('does not expose the removed self-description field', () => {
    show();
    expect(screen.queryByLabelText('I would describe myself as')).toBeNull();
  });

  it('edits an introduction without language or publication controls', () => {
    show();
    fireEvent.change(intro(), { target: { value: 'Building small tools.' } });
    expect((intro() as HTMLTextAreaElement).value).toBe(
      'Building small tools.',
    );
    expect(screen.queryByLabelText('Show publicly: About you')).toBeNull();
    expect(screen.queryByLabelText('Writing language')).toBeNull();
    fireEvent.change(intro(), { target: { value: '' } });
    expect((intro() as HTMLTextAreaElement).value).toBe('');
  });

  it('keeps publication controls for interests', () => {
    show();
    const toggle = screen.getByLabelText(
      'Show publicly: Interests',
    ) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Investing' }));
    expect(toggle.disabled).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
  });

  it('stops a sixth topic without unselecting one the member chose', () => {
    show();
    const topics = [
      'Bootstrapping',
      'Product',
      'Design',
      'Engineering',
      'Customer acquisition',
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

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

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
    });
    show();
    fireEvent.change(intro(), { target: { value: 'Building products' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(screen.getByRole('status').className).toContain('alert-success');
    expect(screen.getByRole('status').closest('.toast')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain(
      'Your profile has been saved.',
    );

    expect(state.save).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          displayName: 'Amina',
          expectedRevision: 4,
          introduction: 'Building products',
        }),
      }),
    );
  });

  it('refuses a link that is not a credential-free https address', () => {
    show();
    fireEvent.change(screen.getByLabelText('Your personal website'), {
      target: { value: 'http://insecure.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('alert').textContent).toContain('https://');
    expect(state.save).not.toHaveBeenCalled();
  });
});
