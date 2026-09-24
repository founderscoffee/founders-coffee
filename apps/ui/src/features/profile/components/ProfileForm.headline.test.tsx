import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import type { UserProfile } from '../api';
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

const show = (profile: UserProfile = savedProfile, locale: Locale = 'en') =>
  render(<ProfileForm profile={profile} locale={locale} onReload={vi.fn()} />);
const headline = () =>
  screen.getByLabelText('What are you building?') as HTMLInputElement;
const stage = (name: string) => screen.getByRole('button', { name });
const pressed = (name: string) => stage(name).getAttribute('aria-pressed');
const publishToggle = (field: string) =>
  screen.getByLabelText(`Show publicly: ${field}`) as HTMLInputElement;
const saved = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await vi.waitFor(() => expect(state.save).toHaveBeenCalled());
  return state.save.mock.calls[0]?.[0].profile;
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('the profile form asks what a member is building (#89)', () => {
  it.each([
    ['ar', 'ما الذي تبنيه؟', 'مرحلة المشروع'],
    ['fr', 'Que construisez-vous ?', 'Stade du projet'],
    ['en', 'What are you building?', 'Project stage'],
  ] as const)(
    'asks it right after the name, before the introduction, in %s',
    (locale, question, stageGroup) => {
      show(savedProfile, locale);

      const name = document.getElementById('profile-name');
      const field = screen.getByLabelText(question);
      const group = screen.getByRole('group', { name: stageGroup });
      const intro = document.getElementById('profile-intro');
      const follows = (a: Node | null, b: Node) =>
        Boolean(
          a && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      expect(follows(name, field)).toBe(true);
      expect(follows(field, group)).toBe(true);
      expect(intro && follows(group, intro)).toBe(true);
    },
  );

  it('counts what the field takes, so the count reaches its limit exactly when typing stops', () => {
    show();
    fireEvent.change(headline(), { target: { value: 'Café app' } });
    expect(screen.getByText('8/80')).toBeTruthy();

    fireEvent.change(headline(), { target: { value: '🚀 app' } });
    expect(screen.getByText('6/80')).toBeTruthy();
    expect(headline().maxLength).toBe(80);
    expect(headline().dir).toBe('auto');
  });

  it('keeps the headline private until its own toggle publishes it', async () => {
    state.save.mockResolvedValue({ ...savedProfile, revision: 5 });
    show();
    expect(publishToggle('What are you building?').disabled).toBe(true);

    fireEvent.change(headline(), {
      target: { value: 'A bookkeeping app for small shops' },
    });
    expect(publishToggle('What are you building?').disabled).toBe(false);
    expect(publishToggle('What are you building?').checked).toBe(false);
    fireEvent.click(publishToggle('What are you building?'));

    expect(await saved()).toMatchObject({
      headline: 'A bookkeeping app for small shops',
      visibility: { headline: true, stage: false },
    });
  });

  it('takes one stage at a time, and lets it be cleared', () => {
    show();
    fireEvent.click(stage('Idea'));
    fireEvent.click(stage('Launched'));

    expect(pressed('Idea')).toBe('false');
    expect(pressed('Launched')).toBe('true');
    expect(stage('Building').hasAttribute('disabled')).toBe(false);

    fireEvent.click(stage('Launched'));
    expect(pressed('Launched')).toBe('false');
    expect(publishToggle('Project stage').disabled).toBe(true);
  });

  it('sends the stage with its own publication choice', async () => {
    state.save.mockResolvedValue({ ...savedProfile, revision: 5 });
    show();
    fireEvent.click(stage('Building'));
    fireEvent.click(publishToggle('Project stage'));

    expect(await saved()).toMatchObject({
      headline: null,
      stage: 'building',
      visibility: { headline: false, stage: true },
    });
  });

  it('discards both back to what was saved', () => {
    show({
      ...savedProfile,
      headline: 'Saved line',
      stage: 'idea',
      visibility: { ...savedProfile.visibility, headline: true, stage: true },
    });
    fireEvent.change(headline(), { target: { value: 'A new line' } });
    fireEvent.click(stage('Launched'));

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(headline().value).toBe('Saved line');
    expect(pressed('Idea')).toBe('true');
    expect(pressed('Launched')).toBe('false');
  });
});
