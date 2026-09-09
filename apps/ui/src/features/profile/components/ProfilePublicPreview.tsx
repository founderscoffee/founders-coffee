import {
  profile_preview_draft,
  profile_preview_empty,
  profile_preview_hint,
  profile_preview_title,
  type Locale,
} from '@founders-coffee/i18n';

import { initials } from '../../../lib/utils';
import { localeLabel, roleLabel, topicLabel } from '../profile-labels';
import type { PublicProfile } from '../api';

export const ProfilePublicPreview = ({
  locale,
  preview,
  isDirty,
}: {
  locale: Locale;
  preview: PublicProfile;
  isDirty: boolean;
}) => {
  const hasDetails =
    preview.introduction !== null ||
    preview.communityRole !== null ||
    preview.interests.length > 0 ||
    preview.spokenLanguages.length > 0 ||
    preview.professionalLink !== null;

  return (
    <aside aria-label={profile_preview_title({}, { locale })}>
      <h2 className="text-label">{profile_preview_title({}, { locale })}</h2>
      <p className="mt-1 text-body-sm text-neutral">
        {profile_preview_hint({}, { locale })}
      </p>
      {isDirty && (
        <p className="mt-1 text-body-sm text-neutral" role="status">
          {profile_preview_draft({}, { locale })}
        </p>
      )}

      <div className="mt-4 rounded-box border border-base-300 bg-base-100 p-5">
        <div className="avatar avatar-placeholder" aria-hidden="true">
          <div className="w-14 rounded-full bg-base-200 text-base-content">
            <span className="text-h4">{initials(preview.displayName)}</span>
          </div>
        </div>
        <p className="mt-3 font-display text-h4 break-words">
          <bdi>{preview.displayName}</bdi>
        </p>

        {preview.introduction && (
          <p
            lang={preview.introductionLocale ?? undefined}
            dir="auto"
            className="mt-3 text-body-sm whitespace-pre-wrap break-words"
          >
            {preview.introduction}
          </p>
        )}
        {preview.communityRole && (
          <p className="mt-3 text-body-sm text-accent">
            {roleLabel(preview.communityRole, locale)}
          </p>
        )}
        {preview.interests.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {preview.interests.map((topic) => (
              <li
                key={topic}
                className="rounded-full bg-base-200 px-2.5 py-0.5 text-caption"
              >
                {topicLabel(topic, locale)}
              </li>
            ))}
          </ul>
        )}
        {preview.spokenLanguages.length > 0 && (
          <p className="mt-3 text-body-sm text-neutral">
            {preview.spokenLanguages
              .map((spoken) => localeLabel(spoken, locale))
              .join(' · ')}
          </p>
        )}
        {preview.professionalLink && (
          <a
            href={preview.professionalLink}
            target="_blank"
            rel="noreferrer nofollow ugc"
            dir="ltr"
            className="mt-3 block text-body-sm break-all underline"
          >
            {preview.professionalLink}
          </a>
        )}
        {!hasDetails && (
          <p className="mt-3 text-body-sm text-neutral">
            {profile_preview_empty({}, { locale })}
          </p>
        )}
      </div>
    </aside>
  );
};
