import {
  LOCALES,
  prefs_always_on,
  prefs_categories_note,
  prefs_categories_title,
  prefs_event_reminders,
  prefs_event_reminders_note,
  prefs_event_updates,
  prefs_event_updates_note,
  prefs_follow_up,
  prefs_follow_up_note,
  prefs_host_updates,
  prefs_host_updates_note,
  prefs_language_title,
  type Locale,
} from '@founders-coffee/i18n';
import { Select } from '@founders-coffee/ui';

import type { NotificationDraft } from '../draft';
import { PreferenceToggle } from './PreferenceToggle';

const LOCALE_LABELS: Record<Locale, string> = {
  ar: 'عربية',
  fr: 'Français',
  en: 'English',
};

export const Group = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-box border border-base-300 bg-base-100 p-5 md:p-6">
    <h2 className="font-display text-h4">{title}</h2>
    {note && <p className="mt-1 text-body-sm text-neutral">{note}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

export const LanguageGroup = ({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: Locale;
  onChange: (next: Locale) => void;
}) => (
  <section>
    <label className="mb-2 block font-display text-h4" htmlFor="prefs-language">
      {prefs_language_title({}, { locale })}
    </label>
    <Select
      id="prefs-language"
      value={value}
      onChange={(event) => onChange(event.target.value as Locale)}
    >
      {LOCALES.map((option) => (
        <option key={option} value={option}>
          {LOCALE_LABELS[option]}
        </option>
      ))}
    </Select>
  </section>
);

export const CategoryGroup = ({
  locale,
  draft,
  onChange,
}: {
  locale: Locale;
  draft: NotificationDraft;
  onChange: (changes: Partial<NotificationDraft>) => void;
}) => (
  <Group
    title={prefs_categories_title({}, { locale })}
    note={prefs_categories_note({}, { locale })}
  >
    <PreferenceToggle
      label={prefs_event_updates({}, { locale })}
      note={prefs_event_updates_note({}, { locale })}
      checked={draft.eventUpdates}
      onChange={(eventUpdates) => onChange({ eventUpdates })}
    />
    <PreferenceToggle
      label={prefs_event_reminders({}, { locale })}
      note={prefs_event_reminders_note({}, { locale })}
      checked={draft.eventReminders}
      onChange={(eventReminders) => onChange({ eventReminders })}
    />
    <PreferenceToggle
      label={prefs_host_updates({}, { locale })}
      note={prefs_host_updates_note({}, { locale })}
      checked={draft.hostUpdates}
      onChange={(hostUpdates) => onChange({ hostUpdates })}
    />
    <PreferenceToggle
      label={prefs_follow_up({}, { locale })}
      note={prefs_follow_up_note({}, { locale })}
      checked={draft.followUpPrompts}
      onChange={(followUpPrompts) => onChange({ followUpPrompts })}
    />
    <p className="mt-3 text-caption text-neutral">
      {prefs_always_on({}, { locale })}
    </p>
  </Group>
);
