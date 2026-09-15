import { describe, expect, it } from 'vitest';

import type { AccountPreferencesView } from './api';
import { draftFrom, hasChanges, localeChanged, toInput } from './draft';

const view = (
  overrides: Partial<AccountPreferencesView> = {},
): AccountPreferencesView => ({
  locale: null,
  revision: 4,
  preferences: {
    eventUpdates: true,
    eventUpdatesChannels: ['push', 'email'],
    eventReminders: true,
    eventRemindersChannels: ['push', 'email'],
    hostUpdates: true,
    hostUpdatesChannels: ['push', 'email'],
    followUpPrompts: false,
    followUpPromptsChannels: [],
    pushEnabled: false,
    smsFallbackEnabled: false,
  },
  smsAvailable: true,
  smsConsentAt: null,
  ...overrides,
});

describe('draftFrom', () => {
  it('carries the locale alongside the switches, as one editable form', () => {
    expect(draftFrom(view({ locale: 'fr' }))).toEqual({
      eventUpdates: true,
      eventUpdatesChannels: ['push', 'email'],
      eventReminders: true,
      eventRemindersChannels: ['push', 'email'],
      hostUpdates: true,
      hostUpdatesChannels: ['push', 'email'],
      followUpPrompts: false,
      followUpPromptsChannels: [],
      pushEnabled: false,
      smsFallbackEnabled: false,
      locale: 'fr',
    });
  });

  it('shows Arabic for an account that has never chosen a language', () => {
    expect(draftFrom(view({ locale: null })).locale).toBe('ar');
  });
});

describe('hasChanges', () => {
  it('is false for an untouched form', () => {
    const saved = view();
    expect(hasChanges(draftFrom(saved), saved)).toBe(false);
  });

  it('notices a switched category', () => {
    const saved = view();
    const draft = { ...draftFrom(saved), hostUpdates: false };
    expect(hasChanges(draft, saved)).toBe(true);
  });

  it('notices a changed language', () => {
    const saved = view({ locale: 'fr' });
    const draft = { ...draftFrom(saved), locale: 'ar' as const };
    expect(hasChanges(draft, saved)).toBe(true);
  });

  it('goes clean again when the server answers with what was asked for', () => {
    const draft = { ...draftFrom(view()), eventReminders: false };
    const answered = view({
      revision: 5,
      preferences: { ...view().preferences, eventReminders: false },
    });
    expect(hasChanges(draft, answered)).toBe(false);
  });

  it('stays dirty when the server kept something the member changed', () => {
    const draft = { ...draftFrom(view()), smsFallbackEnabled: true };
    expect(hasChanges(draft, view())).toBe(true);
  });

  it('treats channel order as a set because masks have no ordering', () => {
    const saved = view();
    const draft = {
      ...draftFrom(saved),
      eventRemindersChannels: ['email', 'push'] as const,
    };
    expect(hasChanges(draft, saved)).toBe(false);
  });

  it('is not made dirty by a device registered in another tab', () => {
    const draft = draftFrom(view());
    const registered = view({
      preferences: { ...view().preferences, pushEnabled: true },
    });
    expect(hasChanges(draft, registered)).toBe(false);
  });
});

describe('toInput', () => {
  it('sends the revision it was given, not one it invented', () => {
    expect(toInput(draftFrom(view()), 4).expectedRevision).toBe(4);
  });

  it('sends the base locale for an account that never chose one', () => {
    expect(toInput(draftFrom(view()), 4)).toHaveProperty('locale', 'ar');
  });

  it('carries no field the update schema would reject', () => {
    expect(Object.keys(toInput(draftFrom(view()), 4)).sort()).toEqual([
      'eventReminders',
      'eventRemindersChannels',
      'eventUpdates',
      'eventUpdatesChannels',
      'expectedRevision',
      'followUpPrompts',
      'followUpPromptsChannels',
      'hostUpdates',
      'hostUpdatesChannels',
      'locale',
      'smsFallbackEnabled',
    ]);
  });

  it('never sends push, which the form has no control for and cannot own', () => {
    expect(toInput(draftFrom(view()), 4)).not.toHaveProperty('pushEnabled');
  });
});

describe('localeChanged', () => {
  it('is true only when the interface language actually moved', () => {
    const saved = view({ locale: 'ar' });
    expect(localeChanged({ ...draftFrom(saved), locale: 'fr' }, saved)).toBe(
      true,
    );
    expect(localeChanged(draftFrom(saved), saved)).toBe(false);
  });

  it('is false for an account that never chose, which already reads as Arabic', () => {
    const saved = view({ locale: null });
    expect(localeChanged(draftFrom(saved), saved)).toBe(false);
  });
});
