import {
  profile_interests_hint,
  profile_interests_label,
  profile_languages_label,
  profile_link_label,
  profile_link_placeholder,
  profile_optional_chip,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

import {
  localeLabel,
  SPOKEN_LOCALE_OPTIONS,
  topicLabel,
  TOPIC_OPTIONS,
} from '../profile-labels';
import type { ProfileDraft } from '../profile-draft';
import { ChipGroup } from './ChipGroup';
import { PublishToggle } from './PublishToggle';

const OptionalChip = ({ locale }: { locale: Locale }) => (
  <span className="rounded-full bg-base-200 px-2 py-0.5 text-caption text-neutral">
    {profile_optional_chip({}, { locale })}
  </span>
);

export const ProfileDetailFields = ({
  locale,
  draft,
  isDisabled,
  onChange,
}: {
  locale: Locale;
  draft: ProfileDraft;
  isDisabled: boolean;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) => {
  const toggle = <T extends string>(
    values: readonly T[],
    option: T,
    max: number,
  ): T[] =>
    values.includes(option)
      ? values.filter((value) => value !== option)
      : values.length >= max
        ? [...values]
        : [...values, option];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-label">
            {profile_interests_label({}, { locale })}
          </span>
          <OptionalChip locale={locale} />
        </div>
        <ChipGroup
          options={TOPIC_OPTIONS}
          selected={draft.interests}
          max={5}
          groupLabel={profile_interests_label({}, { locale })}
          labelFor={(topic) => topicLabel(topic, locale)}
          onToggle={(topic) =>
            onChange({ interests: toggle(draft.interests, topic, 5) })
          }
        />
        <p className="mt-2 text-body-sm text-neutral">
          {profile_interests_hint({}, { locale })}
        </p>
        <PublishToggle
          locale={locale}
          isPublic={draft.visibility.interests}
          isDisabled={isDisabled || draft.interests.length === 0}
          fieldLabel={profile_interests_label({}, { locale })}
          onChange={(isPublic) =>
            onChange({
              visibility: { ...draft.visibility, interests: isPublic },
            })
          }
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-label">
            {profile_languages_label({}, { locale })}
          </span>
          <OptionalChip locale={locale} />
        </div>
        <ChipGroup
          options={SPOKEN_LOCALE_OPTIONS}
          selected={draft.spokenLanguages}
          max={6}
          groupLabel={profile_languages_label({}, { locale })}
          labelFor={(spoken) => localeLabel(spoken, locale)}
          onToggle={(spoken) =>
            onChange({
              spokenLanguages: toggle(draft.spokenLanguages, spoken, 6),
            })
          }
        />
        <PublishToggle
          locale={locale}
          isPublic={draft.visibility.spokenLanguages}
          isDisabled={isDisabled || draft.spokenLanguages.length === 0}
          fieldLabel={profile_languages_label({}, { locale })}
          onChange={(isPublic) =>
            onChange({
              visibility: { ...draft.visibility, spokenLanguages: isPublic },
            })
          }
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label htmlFor="profile-link" className="text-label">
            {profile_link_label({}, { locale })}
          </label>
          <OptionalChip locale={locale} />
        </div>
        <Input
          id="profile-link"
          type="url"
          inputMode="url"
          dir="ltr"
          maxLength={2048}
          value={draft.professionalLink ?? ''}
          disabled={isDisabled}
          placeholder={profile_link_placeholder({}, { locale })}
          onChange={(event) =>
            onChange({ professionalLink: event.target.value || null })
          }
        />
        <PublishToggle
          locale={locale}
          isPublic={draft.visibility.professionalLink}
          isDisabled={isDisabled || !draft.professionalLink}
          fieldLabel={profile_link_label({}, { locale })}
          onChange={(isPublic) =>
            onChange({
              visibility: { ...draft.visibility, professionalLink: isPublic },
            })
          }
        />
      </div>
    </div>
  );
};
