import {
  profile_member_since,
  profile_photo_of,
  profile_stage_label,
  profile_view_link,
  type Locale,
} from '@founders-coffee/i18n';

import { ExternalLink } from 'lucide-react';

import { initials } from '../../../lib/utils';
import { profilePhotoUrl } from '../photo-url';
import { memberSinceLabel, stageLabel } from '../profile-labels';
import type { PublicProfile } from '../api';

export const PublicProfileHeader = ({
  locale,
  profile,
}: {
  locale: Locale;
  profile: PublicProfile;
}) => (
  <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-center gap-4">
      <div
        className="avatar avatar-placeholder shrink-0"
        aria-hidden={profile.photoAssetId ? undefined : true}
      >
        <div className="w-16 rounded-full bg-neutral text-neutral-content">
          {profile.photoAssetId ? (
            <img
              src={profilePhotoUrl(profile.photoAssetId, 'md')}
              alt={profile_photo_of({ name: profile.displayName }, { locale })}
              width={64}
              height={64}
              className="rounded-full object-cover"
            />
          ) : (
            <span className="text-h3">{initials(profile.displayName)}</span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <h1
          id="public-profile-title"
          className="font-display text-h2 font-semibold break-words"
        >
          <bdi>{profile.displayName}</bdi>
        </h1>
        {profile.headline ? (
          <p className="mt-1 text-body-sm text-neutral break-words">
            <bdi>{profile.headline}</bdi>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {profile.stage ? (
            <dl>
              <dt className="sr-only">{profile_stage_label({}, { locale })}</dt>
              <dd className="rounded-full bg-base-100 px-2.5 py-0.5 text-caption font-medium">
                {stageLabel(profile.stage, locale)}
              </dd>
            </dl>
          ) : null}
          <p className="text-body-sm text-neutral">
            {profile_member_since(
              { date: memberSinceLabel(profile.memberSince, locale) },
              { locale },
            )}
          </p>
        </div>
      </div>
    </div>
    {profile.professionalLink ? (
      <a
        href={profile.professionalLink}
        target="_blank"
        rel="noreferrer nofollow ugc"
        dir="ltr"
        aria-label={`${profile_view_link({}, { locale })}: ${profile.professionalLink}`}
        className="btn btn-outline h-10 min-h-10 shrink-0 self-start px-3"
      >
        <span>{profile_view_link({}, { locale })}</span>
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    ) : null}
  </header>
);
