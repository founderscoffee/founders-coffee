import { describe, expect, it } from 'vitest';

import type { UserProfile } from './api';
import { commandFrom, draftFrom, isDraftDirty } from './profile-draft';

const saved: UserProfile = {
  userId: 'usr_1',
  displayName: 'Amina',
  revision: 3,
  photoAssetId: null,
  memberSince: '2026-03',
  headline: null,
  stage: null,
  introduction: null,
  interests: [],
  spokenLanguages: [],
  professionalLink: null,
  visibility: {
    headline: false,
    stage: false,
    interests: false,
    spokenLanguages: false,
    professionalLink: false,
  },
};

describe('profile draft', () => {
  it('starts clean and detects a change in any field', () => {
    const draft = draftFrom(saved);
    expect(isDraftDirty(draft, saved)).toBe(false);

    expect(
      isDraftDirty(
        { ...draft, professionalLink: 'https://example.com' },
        saved,
      ),
    ).toBe(true);
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
    expect(isDraftDirty({ ...draft, headline: 'A shop app' }, saved)).toBe(
      true,
    );
    expect(isDraftDirty({ ...draft, stage: 'idea' }, saved)).toBe(true);
    expect(
      isDraftDirty(
        { ...draft, visibility: { ...draft.visibility, stage: true } },
        saved,
      ),
    ).toBe(true);
  });

  it('does not call a rebuilt but identical array dirty', () => {
    const withTopics: UserProfile = { ...saved, interests: ['product'] };
    expect(isDraftDirty(draftFrom(withTopics), withTopics)).toBe(false);
  });

  it('accepts the introduction without inventing its language', () => {
    const built = commandFrom(
      { ...draftFrom(saved), introduction: 'Building small tools.' },
      3,
    );

    expect(built.ok && built.command.introduction).toBe(
      'Building small tools.',
    );
    expect(built.ok && built.command).not.toHaveProperty('introductionLocale');
  });

  it('reports the field that stops a save rather than a generic failure', () => {
    const built = commandFrom(
      { ...draftFrom(saved), professionalLink: 'http://insecure.example' },
      3,
    );

    expect(built).toMatchObject({ ok: false, field: 'professionalLink' });
  });

  it('withdraws a publication whose field is emptied', () => {
    const built = commandFrom(
      {
        ...draftFrom(saved),
        professionalLink: null,
        visibility: { ...saved.visibility, professionalLink: true },
      },
      3,
    );

    expect(built.ok && built.command.visibility.professionalLink).toBe(false);
  });

  it('sends what a member is building and its stage, withdrawing a publication left empty', () => {
    const built = commandFrom(
      {
        ...draftFrom(saved),
        headline: '  A bookkeeping app  ',
        stage: null,
        visibility: { ...saved.visibility, headline: true, stage: true },
      },
      3,
    );

    expect(built.ok && built.command).toMatchObject({
      headline: 'A bookkeeping app',
      stage: null,
      visibility: { headline: true, stage: false },
    });
  });
});
