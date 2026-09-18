import {
  profile_publish_private,
  profile_publish_public,
  type Locale,
} from '@founders-coffee/i18n';

export const PublishToggle = ({
  locale,
  isPublic,
  isDisabled,
  fieldLabel,
  onChange,
}: {
  locale: Locale;
  isPublic: boolean;
  isDisabled?: boolean;
  fieldLabel: string;
  onChange: (isPublic: boolean) => void;
}) => (
  <div className="mt-2 flex items-center justify-between gap-3">
    <span
      className={`text-body-sm ${isPublic ? 'text-accent' : 'text-neutral'}`}
    >
      {isPublic
        ? profile_publish_public({}, { locale })
        : profile_publish_private({}, { locale })}
    </span>
    <label className="flex cursor-pointer items-center gap-2">
      <span className="text-body-sm text-neutral">
        {profile_publish_public({}, { locale })}
      </span>
      <input
        type="checkbox"
        className="toggle toggle-primary toggle-sm"
        checked={isPublic}
        disabled={isDisabled}
        aria-label={`${profile_publish_public({}, { locale })}: ${fieldLabel}`}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  </div>
);
