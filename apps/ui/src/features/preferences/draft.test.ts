import { describe, expect, it } from 'vitest';

import type { AccountPreferencesView } from './api';
import { draftFrom, hasChanges, toInput } from './draft';

const view = (
  overrides: Partial<AccountPreferencesView> = {},
): AccountPreferencesView => ({
  revision: 4,
  preferences: {
    eventUpdates: true,
    eventUpdatesChannels: ['push', 'email'],
    eventReminders: true,
    eventRemindersChannels: ['push', 'email'],
    hostRsvpReceived: true,
    hostRsvpReceivedChannels: ['push', 'email'],
    hostRsvpCancelled: true,
    hostRsvpCancelledChannels: ['push', 'email'],
    followUpPrompts: false,
    followUpPromptsChannels: [],
    meetupChat: true,
    meetupChatChannels: ['push'],
    pushEnabled: false,
    smsFallbackEnabled: false,
  },
  smsAvailable: true,
  smsConsentAt: null,
  meetupChatAvailable: true,
  ...overrides,
});

describe('draftFrom', () => {
  it('carries the notification switches as one editable form', () => {
    expect(draftFrom(view())).toEqual({
      eventUpdates: true,
      eventUpdatesChannels: ['push', 'email'],
      eventReminders: true,
      eventRemindersChannels: ['push', 'email'],
      hostRsvpReceived: true,
      hostRsvpReceivedChannels: ['push', 'email'],
      hostRsvpCancelled: true,
      hostRsvpCancelledChannels: ['push', 'email'],
      followUpPrompts: false,
      followUpPromptsChannels: [],
      meetupChat: true,
      meetupChatChannels: ['push'],
      pushEnabled: false,
      smsFallbackEnabled: false,
    });
  });
});

describe('hasChanges', () => {
  it('is false for an untouched form', () => {
    const saved = view();
    expect(hasChanges(draftFrom(saved), saved)).toBe(false);
  });

  it('notices a switched category', () => {
    const saved = view();
    const draft = { ...draftFrom(saved), hostRsvpReceived: false };
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

  it('carries no field the update schema would reject', () => {
    expect(Object.keys(toInput(draftFrom(view()), 4)).sort()).toEqual([
      'eventReminders',
      'eventRemindersChannels',
      'eventUpdates',
      'eventUpdatesChannels',
      'expectedRevision',
      'followUpPrompts',
      'followUpPromptsChannels',
      'hostRsvpCancelled',
      'hostRsvpCancelledChannels',
      'hostRsvpReceived',
      'hostRsvpReceivedChannels',
      'meetupChat',
      'meetupChatChannels',
      'smsFallbackEnabled',
    ]);
  });

  it('sends the meetup chat on push alone, or on nothing once it is off', () => {
    const on = toInput({ ...draftFrom(view()), meetupChatChannels: [] }, 4);
    const off = toInput(
      { ...draftFrom(view()), meetupChat: false, meetupChatChannels: ['push'] },
      4,
    );

    expect(on).toMatchObject({
      meetupChat: true,
      meetupChatChannels: ['push'],
    });
    expect(off).toMatchObject({ meetupChat: false, meetupChatChannels: [] });
  });

  it('never sends push, which the form has no control for and cannot own', () => {
    expect(toInput(draftFrom(view()), 4)).not.toHaveProperty('pushEnabled');
  });
});
