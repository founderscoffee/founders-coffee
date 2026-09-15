import { baseLocale, type Locale } from '@founders-coffee/i18n';

import type { AccountPreferencesView, PreferencesInput } from './api';

export interface NotificationDraft {
  readonly eventUpdates: boolean;
  readonly eventUpdatesChannels: readonly PreferencesInput['eventUpdatesChannels'][number][];
  readonly eventReminders: boolean;
  readonly eventRemindersChannels: readonly PreferencesInput['eventRemindersChannels'][number][];
  readonly hostUpdates: boolean;
  readonly hostUpdatesChannels: readonly PreferencesInput['hostUpdatesChannels'][number][];
  readonly followUpPrompts: boolean;
  readonly followUpPromptsChannels: readonly PreferencesInput['followUpPromptsChannels'][number][];
  readonly pushEnabled: boolean;
  readonly smsFallbackEnabled: boolean;
}

const channelsEqual = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length &&
  left.every((channel) => right.includes(channel));

const channelsForCategory = <T extends string>(
  enabled: boolean,
  channels: readonly T[],
): readonly T[] =>
  enabled ? (channels.length > 0 ? channels : (['push', 'email'] as T[])) : [];

export interface PreferencesDraft extends NotificationDraft {
  readonly locale: Locale;
}

/**
 * The saved preferences as an editable form.
 *
 * An account that has never chosen a language stores `null`, and the form shows the base locale
 * rather than a fourth "no choice" option: the server render already falls back to it, so `null`
 * and `ar` look identical on screen and offering both would be a distinction without a difference.
 * Every comparison here goes through this function, so a member who has chosen nothing still opens
 * a clean form instead of one claiming an unsaved change they did not make.
 */
export const draftFrom = (view: AccountPreferencesView): PreferencesDraft => ({
  ...view.preferences,
  locale: view.locale ?? baseLocale,
});

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
    ...channelsForCategory(draft.eventUpdates, draft.eventUpdatesChannels),
  ],
  eventReminders: draft.eventReminders,
  eventRemindersChannels: [
    ...channelsForCategory(draft.eventReminders, draft.eventRemindersChannels),
  ],
  hostUpdates: draft.hostUpdates,
  hostUpdatesChannels: [
    ...channelsForCategory(draft.hostUpdates, draft.hostUpdatesChannels),
  ],
  followUpPrompts: draft.followUpPrompts,
  followUpPromptsChannels: [
    ...channelsForCategory(
      draft.followUpPrompts,
      draft.followUpPromptsChannels,
    ),
  ],
  smsFallbackEnabled: draft.smsFallbackEnabled,
  locale: draft.locale,
  expectedRevision: revision,
});

/**
 * Whether the page has to reload after saving.
 *
 * Only when the interface language actually changed. Paraglide resolves the locale during the
 * server render, so the strings already on screen were chosen before the save; re-rendering in
 * React would translate the parts that re-render and leave the rest, which is worse than either
 * outcome. The cookie is written first so the reload comes back in the new language.
 */
export const localeChanged = (
  draft: PreferencesDraft,
  view: AccountPreferencesView,
): boolean => draft.locale !== draftFrom(view).locale;
