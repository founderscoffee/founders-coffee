import type { AccountPreferencesView, PreferencesInput } from './api';

export interface NotificationDraft {
  readonly eventUpdates: boolean;
  readonly eventUpdatesChannels: readonly PreferencesInput['eventUpdatesChannels'][number][];
  readonly eventReminders: boolean;
  readonly eventRemindersChannels: readonly PreferencesInput['eventRemindersChannels'][number][];
  readonly hostRsvpReceived: boolean;
  readonly hostRsvpReceivedChannels: readonly PreferencesInput['hostRsvpReceivedChannels'][number][];
  readonly hostRsvpCancelled: boolean;
  readonly hostRsvpCancelledChannels: readonly PreferencesInput['hostRsvpCancelledChannels'][number][];
  readonly followUpPrompts: boolean;
  readonly followUpPromptsChannels: readonly PreferencesInput['followUpPromptsChannels'][number][];
  readonly meetupChat: boolean;
  readonly meetupChatChannels: readonly PreferencesInput['meetupChatChannels'][number][];
  readonly pushEnabled: boolean;
  readonly smsFallbackEnabled: boolean;
}

const channelsEqual = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length &&
  left.every((channel) => right.includes(channel));

const EVERY_CHANNEL: readonly PreferencesInput['eventUpdatesChannels'][number][] =
  ['push', 'email'];
const CHAT_CHANNELS: readonly PreferencesInput['meetupChatChannels'][number][] =
  ['push'];

const channelsForCategory = <T extends string>(
  enabled: boolean,
  channels: readonly T[],
  offered: readonly T[],
): readonly T[] => (enabled ? (channels.length > 0 ? channels : offered) : []);

export type PreferencesDraft = NotificationDraft;

/**
 * The saved preferences as an editable form.
 *
 * The notification form contains only delivery policy. Interface language is managed on Account.
 */
export const draftFrom = (view: AccountPreferencesView): PreferencesDraft =>
  view.preferences;

/**
 * Whether anything in the form differs from what is saved.
 *
 * Compared field by field against the server's own answer rather than tracked with a dirty flag,
 * so a save that the server adjusted — a consent it refused, a revision it bumped — leaves the form
 * clean rather than permanently claiming unsaved changes the member cannot resolve.
 *
 * `pushEnabled` is excluded because the form cannot change it: registering a device on another tab
 * would otherwise leave this one claiming unsaved changes that no control on it can resolve.
 */
export const hasChanges = (
  draft: PreferencesDraft,
  view: AccountPreferencesView,
): boolean => {
  const saved = draftFrom(view);
  return (Object.keys(saved) as (keyof PreferencesDraft)[]).some(
    (key) =>
      key !== 'pushEnabled' &&
      (Array.isArray(draft[key]) && Array.isArray(saved[key])
        ? !channelsEqual(
            draft[key] as readonly string[],
            saved[key] as readonly string[],
          )
        : draft[key] !== saved[key]),
  );
};

/**
 * The fields a member may actually set, and nothing else.
 *
 * `pushEnabled` is deliberately absent. There is no switch for it on the screen — browser
 * permission is not a page's to set — so it is written by device registration and owned by the
 * server. Sending the draft's stale copy back would let a form loaded before a device registered
 * turn push off on save.
 */
export const toInput = (
  draft: PreferencesDraft,
  revision: number,
): PreferencesInput => ({
  eventUpdates: draft.eventUpdates,
  eventUpdatesChannels: [
    ...channelsForCategory(
      draft.eventUpdates,
      draft.eventUpdatesChannels,
      EVERY_CHANNEL,
    ),
  ],
  eventReminders: draft.eventReminders,
  eventRemindersChannels: [
    ...channelsForCategory(
      draft.eventReminders,
      draft.eventRemindersChannels,
      EVERY_CHANNEL,
    ),
  ],
  hostRsvpReceived: draft.hostRsvpReceived,
  hostRsvpReceivedChannels: [
    ...channelsForCategory(
      draft.hostRsvpReceived,
      draft.hostRsvpReceivedChannels,
      EVERY_CHANNEL,
    ),
  ],
  hostRsvpCancelled: draft.hostRsvpCancelled,
  hostRsvpCancelledChannels: [
    ...channelsForCategory(
      draft.hostRsvpCancelled,
      draft.hostRsvpCancelledChannels,
      EVERY_CHANNEL,
    ),
  ],
  followUpPrompts: draft.followUpPrompts,
  followUpPromptsChannels: [
    ...channelsForCategory(
      draft.followUpPrompts,
      draft.followUpPromptsChannels,
      EVERY_CHANNEL,
    ),
  ],
  meetupChat: draft.meetupChat,
  meetupChatChannels: [
    ...channelsForCategory(
      draft.meetupChat,
      draft.meetupChatChannels,
      CHAT_CHANNELS,
    ),
  ],
  smsFallbackEnabled: draft.smsFallbackEnabled,
  expectedRevision: revision,
});
