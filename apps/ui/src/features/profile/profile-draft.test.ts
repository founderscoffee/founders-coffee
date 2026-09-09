import { describe, expect, it } from 'vitest';

import type { UserProfile } from './api';
import {
  commandFrom,
  draftFrom,
  isDraftDirty,
  previewFrom,
} from './profile-draft';

const saved: UserProfile = {
  userId: 'usr_1',
  displayName: 'Amina',
  revision: 3,
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

describe('profile draft', () => {
  it('starts clean and detects a change in any field', () => {
    const draft = draftFrom(saved);
    expect(isDraftDirty(draft, saved)).toBe(false);

    expect(isDraftDirty({ ...draft, communityRole: 'founder' }, saved)).toBe(
      true,
    );
    expect(isDraftDirty({ ...draft, interests: ['product'] }, saved)).toBe(
      true,
    );
    expect(isDraftDirty({ ...draft, spokenLanguages: ['ar'] }, saved)).toBe(
      true,
    );
    expect(
      isDraftDirty(
        { ...draft, visibility: { ...draft.visibility, interests: true } },
        saved,
      ),
    ).toBe(true);
  });

  it('does not call a rebuilt but identical array dirty', () => {
    const withTopics: UserProfile = { ...saved, interests: ['product'] };
    expect(isDraftDirty(draftFrom(withTopics), withTopics)).toBe(false);
  });

  it('supplies the authored language the schema demands', () => {
    const built = commandFrom(
      { ...draftFrom(saved), introduction: 'Building small tools.' },
      3,
      'fr',
    );

    expect(built.ok && built.command.introductionLocale).toBe('fr');
  });

  it('reports the field that stops a save rather than a generic failure', () => {
    const built = commandFrom(
      { ...draftFrom(saved), professionalLink: 'http://insecure.example' },
      3,
      'en',
    );

    expect(built).toMatchObject({ ok: false, field: 'professionalLink' });
  });

  it('withdraws a publication whose field is emptied', () => {
    const built = commandFrom(
      {
        ...draftFrom(saved),
        introduction: null,
        visibility: { ...saved.visibility, introduction: true },
      },
      3,
      'en',
    );

    expect(built.ok && built.command.visibility.introduction).toBe(false);
  });

  it('previews exactly what publication allows, and nothing else', () => {
    const draft = {
      ...draftFrom(saved),
      introduction: 'Building small tools.',
      introductionLocale: 'en' as const,
      communityRole: 'founder' as const,
      interests: ['product' as const],
      visibility: {
        ...saved.visibility,
        introduction: true,
        communityRole: false,
        interests: true,
      },
    };

    const preview = previewFrom(draft, saved, 'en');

    expect(preview).toMatchObject({
      displayName: 'Amina',
      introduction: 'Building small tools.',
      communityRole: null,
      interests: ['product'],
    });
  });

  it('returns nothing while the draft cannot be saved, so the panel can hold', () => {
    expect(
      previewFrom(
        { ...draftFrom(saved), introduction: 'x'.repeat(301) },
        saved,
        'en',
      ),
    ).toBeNull();
  });
});
