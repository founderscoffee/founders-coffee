import {
  prefs_email,
  prefs_event_reminders,
  prefs_event_reminders_note,
  prefs_event_updates,
  prefs_event_updates_note,
  prefs_follow_up,
  prefs_follow_up_note,
  prefs_host_rsvp_cancelled,
  prefs_host_rsvp_cancelled_note,
  prefs_host_rsvp_received,
  prefs_host_rsvp_received_note,
  prefs_push,
  prefs_push_checking,
  prefs_push_denied,
  prefs_push_enable,
  prefs_push_install,
  prefs_push_registered,
  prefs_push_undeliverable,
  prefs_push_unavailable,
  prefs_push_unregistered,
  prefs_push_unsupported,
  type Locale,
} from '@founders-coffee/i18n';

import type { NotificationDraft } from '../draft';
import { pushIsActionable, type PushState } from '../push-state';

type NotificationChannel = NotificationDraft['eventUpdatesChannels'][number];
type EnabledField =
  | 'eventUpdates'
  | 'eventReminders'
  | 'hostRsvpReceived'
  | 'hostRsvpCancelled'
  | 'followUpPrompts';
type ChannelsField =
  | 'eventUpdatesChannels'
  | 'eventRemindersChannels'
  | 'hostRsvpReceivedChannels'
  | 'hostRsvpCancelledChannels'
  | 'followUpPromptsChannels';

type CategoryDefinition = {
  readonly enabledField: EnabledField;
  readonly channelsField: ChannelsField;
  readonly label: (locale: Locale) => string;
  readonly note: (locale: Locale) => string;
};

const CHANNELS: readonly NotificationChannel[] = ['push', 'email'];

const CATEGORIES: readonly CategoryDefinition[] = [
  {
    enabledField: 'eventUpdates',
    channelsField: 'eventUpdatesChannels',
    label: (locale) => prefs_event_updates({}, { locale }),
    note: (locale) => prefs_event_updates_note({}, { locale }),
  },
  {
    enabledField: 'eventReminders',
    channelsField: 'eventRemindersChannels',
    label: (locale) => prefs_event_reminders({}, { locale }),
    note: (locale) => prefs_event_reminders_note({}, { locale }),
  },
  {
    enabledField: 'hostRsvpReceived',
    channelsField: 'hostRsvpReceivedChannels',
    label: (locale) => prefs_host_rsvp_received({}, { locale }),
    note: (locale) => prefs_host_rsvp_received_note({}, { locale }),
  },
  {
    enabledField: 'hostRsvpCancelled',
    channelsField: 'hostRsvpCancelledChannels',
    label: (locale) => prefs_host_rsvp_cancelled({}, { locale }),
    note: (locale) => prefs_host_rsvp_cancelled_note({}, { locale }),
  },
  {
    enabledField: 'followUpPrompts',
    channelsField: 'followUpPromptsChannels',
    label: (locale) => prefs_follow_up({}, { locale }),
    note: (locale) => prefs_follow_up_note({}, { locale }),
  },
];

const PUSH_EXPLANATION: Partial<Record<PushState, (locale: Locale) => string>> =
  {
    checking: (locale) => prefs_push_checking({}, { locale }),
    unsupported: (locale) => prefs_push_unsupported({}, { locale }),
    install_required: (locale) => prefs_push_install({}, { locale }),
    unavailable: (locale) => prefs_push_unavailable({}, { locale }),
    denied: (locale) => prefs_push_denied({}, { locale }),
    granted_unregistered: (locale) => prefs_push_unregistered({}, { locale }),
    delivery_unavailable: (locale) => prefs_push_undeliverable({}, { locale }),
    registered: (locale) => prefs_push_registered({}, { locale }),
  };

const channelLabel = (channel: NotificationChannel, locale: Locale): string =>
  channel === 'push' ? prefs_push({}, { locale }) : prefs_email({}, { locale });

const channelAccessibleLabel = (
  category: CategoryDefinition,
  channel: NotificationChannel,
  locale: Locale,
  checked: boolean,
  pushState: PushState,
): string => {
  const label = `${category.label(locale)}: ${channelLabel(channel, locale)}`;
  return channel === 'push' && !checked && pushIsActionable(pushState)
    ? `${label} (${prefs_push_enable({}, { locale })})`
    : label;
};

const pushDisabledFor = (
  state: PushState,
  checked: boolean,
  isEnabling: boolean,
): boolean =>
  state === 'checking' ||
  isEnabling ||
  (state !== 'registered' && !pushIsActionable(state) && !checked);

const selectedChannels = (
  draft: NotificationDraft,
  category: CategoryDefinition,
  showPush: boolean,
): readonly NotificationChannel[] => {
  if (!draft[category.enabledField]) return [];
  const channels = draft[
    category.channelsField
  ] as readonly NotificationChannel[];
  const selected = channels.length > 0 ? channels : CHANNELS;
  return selected.filter((channel) => channel !== 'push' || showPush);
};

const toggleChannel = (
  draft: NotificationDraft,
  category: CategoryDefinition,
  channel: NotificationChannel,
  showPush: boolean,
): Partial<NotificationDraft> => {
  const selected = selectedChannels(draft, category, showPush);
  const next = selected.includes(channel)
    ? selected.filter((current) => current !== channel)
    : [...selected, channel];
  return {
    [category.enabledField]: next.length > 0,
    [category.channelsField]: next,
  } as Partial<NotificationDraft>;
};

export const NotificationChannelGrid = ({
  locale,
  draft,
  pushState,
  isEnabling,
  onEnablePush,
  onChange,
}: {
  locale: Locale;
  draft: NotificationDraft;
  pushState: PushState;
  isEnabling: boolean;
  onEnablePush: () => Promise<boolean>;
  onChange: (changes: Partial<NotificationDraft>) => void;
}) => {
  const showPush = pushState !== 'unavailable';

  const handleChange = async (
    category: CategoryDefinition,
    channel: NotificationChannel,
  ) => {
    const selected = selectedChannels(draft, category, showPush).includes(
      channel,
    );
    if (channel === 'push' && !selected && pushIsActionable(pushState)) {
      const enabled = await onEnablePush();
      if (!enabled) return;
    }
    onChange(toggleChannel(draft, category, channel, showPush));
  };

  const explanation =
    pushState === 'not_requested' ? undefined : PUSH_EXPLANATION[pushState];

  return (
    <div className="mt-5 min-w-0">
      <div className="hidden border-b border-base-200 pb-3 text-caption font-medium text-neutral md:grid md:grid-cols-[minmax(0,1fr)_7rem_7rem] md:items-center md:gap-3">
        <span />
        <span className="text-center">{prefs_push({}, { locale })}</span>
        <span className="text-center">{prefs_email({}, { locale })}</span>
      </div>
      {CATEGORIES.map((category) => {
        const selected = selectedChannels(draft, category, showPush);
        return (
          <div
            className="grid gap-3 border-b border-base-200 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_7rem_7rem] md:items-center md:gap-3"
            key={category.enabledField}
          >
            <div className="min-w-0">
              <p className="text-body-sm font-medium">
                {category.label(locale)}
              </p>
              <p className="mt-1 text-caption text-neutral">
                {category.note(locale)}
              </p>
            </div>
            {CHANNELS.filter((channel) => channel !== 'push' || showPush).map(
              (channel) => {
                const checked = selected.includes(channel);
                const label = channelLabel(channel, locale);
                return (
                  <label
                    className="label min-h-10 cursor-pointer gap-2 rounded-btn border border-base-300 px-3 py-2 md:justify-center md:border-0 md:p-0"
                    key={channel}
                  >
                    <input
                      aria-label={channelAccessibleLabel(
                        category,
                        channel,
                        locale,
                        checked,
                        pushState,
                      )}
                      checked={checked}
                      className="checkbox checkbox-primary checkbox-sm md:checkbox-md"
                      disabled={
                        channel === 'push' &&
                        pushDisabledFor(pushState, checked, isEnabling)
                      }
                      onChange={() => void handleChange(category, channel)}
                      type="checkbox"
                    />
                    <span className="md:hidden">{label}</span>
                  </label>
                );
              },
            )}
          </div>
        );
      })}
      {explanation && (
        <p className="mt-3 text-caption text-neutral" aria-live="polite">
          {explanation(locale)}
        </p>
      )}
    </div>
  );
};
