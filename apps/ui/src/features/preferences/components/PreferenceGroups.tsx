import { Link } from '@tanstack/react-router';

import {
  LOCALES,
  formatDate,
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
  prefs_location,
  prefs_location_forget,
  prefs_location_forgotten,
  prefs_location_none,
  prefs_location_note,
  prefs_location_title,
  prefs_sms,
  prefs_sms_consented,
  prefs_sms_go_to_account,
  prefs_sms_note,
  prefs_sms_requires_phone,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Select } from '@founders-coffee/ui';

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

export const SmsRow = ({
  locale,
  checked,
  available,
  consentAt,
  onChange,
}: {
  locale: Locale;
  checked: boolean;
  available: boolean;
  consentAt: string | null;
  onChange: (next: boolean) => void;
}) => (
  <>
    <PreferenceToggle
      label={prefs_sms({}, { locale })}
      note={
        available
          ? prefs_sms_note({}, { locale })
          : prefs_sms_requires_phone({}, { locale })
      }
      checked={checked}
      disabled={!available && !checked}
      onChange={onChange}
    />
    {available && consentAt && (
      <p className="mt-2 text-caption text-neutral">
        {prefs_sms_consented(
          {
            date: formatDate(new Date(consentAt), locale, {
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          },
          { locale },
        )}
      </p>
    )}
    {!available && (
      <Link className="btn btn-outline btn-sm mt-3" to="/account">
        {prefs_sms_go_to_account({}, { locale })}
      </Link>
    )}
  </>
);

export const DeviceLocationGroup = ({
  locale,
  remembered,
  onForget,
}: {
  locale: Locale;
  remembered: string | null;
  onForget: () => void;
}) => (
  <Group title={prefs_location_title({}, { locale })}>
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-medium">
          {prefs_location({}, { locale })}
        </p>
        <p className="mt-0.5 text-caption text-neutral" aria-live="polite">
          {remembered ?? prefs_location_none({}, { locale })}
        </p>
        <p className="mt-0.5 text-caption text-neutral">
          {prefs_location_note({}, { locale })}
        </p>
      </div>
      {remembered ? (
        <Button type="button" variant="outline" size="sm" onClick={onForget}>
          {prefs_location_forget({}, { locale })}
        </Button>
      ) : (
        <span className="text-caption text-neutral">
          {prefs_location_forgotten({}, { locale })}
        </span>
      )}
    </div>
  </Group>
);
