import {
  LOCALES,
  prefs_always_on,
  prefs_categories_note,
  prefs_categories_title,
  prefs_delivery_note,
  prefs_delivery_title,
  prefs_language_title,
  type Locale,
} from '@founders-coffee/i18n';
import { Select } from '@founders-coffee/ui';

import type { NotificationDraft } from '../draft';
import type { PushState } from '../push-state';
import { NotificationChannelGrid } from './NotificationChannelGrid';

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
}) => (
  <Group
    title={prefs_categories_title({}, { locale })}
    note={prefs_categories_note({}, { locale })}
  >
    <div className="border-b border-base-200 pb-4">
      <h3 className="font-display text-h5">
        {prefs_delivery_title({}, { locale })}
      </h3>
      <p className="mt-1 text-body-sm text-neutral">
        {prefs_delivery_note({}, { locale })}
      </p>
    </div>
    <NotificationChannelGrid
      locale={locale}
      draft={draft}
      pushState={pushState}
      isEnabling={isEnabling}
      onEnablePush={onEnablePush}
      onChange={onChange}
    />
    <p className="mt-3 text-caption text-neutral">
      {prefs_always_on({}, { locale })}
    </p>
  </Group>
);
