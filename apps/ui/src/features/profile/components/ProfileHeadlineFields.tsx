import {
  profile_headline_counter,
  profile_headline_label,
  profile_headline_placeholder,
  profile_stage_label,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

import type { ProfileDraft } from '../profile-draft';
import { stageLabel, STAGE_OPTIONS } from '../profile-labels';
import { ChipGroup } from './ChipGroup';
import { OptionalChip } from './OptionalChip';
import { PublishToggle } from './PublishToggle';

export const ProfileHeadlineFields = ({
  locale,
  draft,
  isDisabled,
  onChange,
}: {
  locale: Locale;
  draft: ProfileDraft;
  isDisabled: boolean;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) => (
  <>
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor="profile-headline" className="text-label">
          {profile_headline_label({}, { locale })}
        </label>
        <OptionalChip locale={locale} />
      </div>
      <Input
        id="profile-headline"
        name="headline"
        dir="auto"
        maxLength={80}
        value={draft.headline ?? ''}
        disabled={isDisabled}
        placeholder={profile_headline_placeholder({}, { locale })}
        aria-describedby="profile-headline-count"
        onChange={(event) => onChange({ headline: event.target.value || null })}
      />
      <p
        id="profile-headline-count"
        className="mt-1.5 text-body-sm text-neutral"
      >
        {profile_headline_counter(
          { count: draft.headline?.length ?? 0 },
          { locale },
        )}
      </p>
      <PublishToggle
        locale={locale}
        isPublic={draft.visibility.headline}
        isDisabled={isDisabled || !draft.headline}
        fieldLabel={profile_headline_label({}, { locale })}
        onChange={(isPublic) =>
          onChange({ visibility: { ...draft.visibility, headline: isPublic } })
        }
      />
    </div>

    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-label">
          {profile_stage_label({}, { locale })}
        </span>
        <OptionalChip locale={locale} />
      </div>
      <ChipGroup
        options={STAGE_OPTIONS}
        selected={draft.stage ? [draft.stage] : []}
        max={STAGE_OPTIONS.length}
        groupLabel={profile_stage_label({}, { locale })}
        labelFor={(stage) => stageLabel(stage, locale)}
        onToggle={(stage) =>
          onChange({ stage: draft.stage === stage ? null : stage })
        }
      />
      <PublishToggle
        locale={locale}
        isPublic={draft.visibility.stage}
        isDisabled={isDisabled || draft.stage === null}
        fieldLabel={profile_stage_label({}, { locale })}
        onChange={(isPublic) =>
          onChange({ visibility: { ...draft.visibility, stage: isPublic } })
        }
      />
    </div>
  </>
);
