import {
  profile_intro_counter,
  profile_intro_label,
  profile_intro_placeholder,
  profile_name_hint,
  profile_name_label,
  profile_optional_chip,
  profile_public_chip,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

import type { ProfileDraft } from '../profile-draft';

export const ProfileIntroFields = ({
  locale,
  draft,
  isDisabled,
  nameRef,
  hasNameError,
  onChange,
}: {
  locale: Locale;
  draft: ProfileDraft;
  isDisabled: boolean;
  nameRef: React.Ref<HTMLInputElement>;
  hasNameError: boolean;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) => (
  <div className="space-y-6">
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor="profile-name" className="text-label">
          {profile_name_label({}, { locale })}
        </label>
        <span className="rounded-full bg-base-200 px-2 py-0.5 text-caption text-neutral">
          {profile_public_chip({}, { locale })}
        </span>
      </div>
      <Input
        id="profile-name"
        ref={nameRef}
        name="displayName"
        autoComplete="nickname"
        maxLength={160}
        value={draft.displayName}
        disabled={isDisabled}
        aria-invalid={hasNameError}
        aria-describedby="profile-name-help"
        onChange={(event) => onChange({ displayName: event.target.value })}
      />
      <p id="profile-name-help" className="mt-1.5 text-body-sm text-neutral">
        {profile_name_hint({}, { locale })}
      </p>
    </div>

    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor="profile-intro" className="text-label">
          {profile_intro_label({}, { locale })}
        </label>
        <span className="rounded-full bg-base-200 px-2 py-0.5 text-caption text-neutral">
          {profile_optional_chip({}, { locale })}
        </span>
      </div>
      <textarea
        id="profile-intro"
        className="textarea textarea-bordered w-full"
        rows={4}
        dir="auto"
        value={draft.introduction ?? ''}
        disabled={isDisabled}
        placeholder={profile_intro_placeholder({}, { locale })}
        aria-describedby="profile-intro-count"
        onChange={(event) =>
          onChange({ introduction: event.target.value || null })
        }
      />
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span id="profile-intro-count" className="text-body-sm text-neutral">
          {profile_intro_counter(
            { count: Array.from(draft.introduction ?? '').length },
            { locale },
          )}
        </span>
      </div>
    </div>
  </div>
);
