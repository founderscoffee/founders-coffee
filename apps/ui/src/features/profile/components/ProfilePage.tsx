import { useState } from 'react';

import {
  profile_title,
  profile_unsaved_leave,
  profile_unsaved_stay,
  profile_unsaved_title,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { ProfileSectionNav } from '../../account/components/ProfileSectionNav';
import { useMyProfile } from '../hooks';
import { useUnsavedGuard } from '../useUnsavedGuard';
import { ProfileAccess } from './ProfileAccess';
import { ProfileForm } from './ProfileForm';

export const ProfilePage = ({ locale }: { locale: Locale }) => {
  const query = useMyProfile();
  const [isDirty, setIsDirty] = useState(false);
  const guard = useUnsavedGuard(isDirty);
  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-12">
      <ProfileSectionNav locale={locale} />
      <div className="min-w-0">
        <h1 className="mb-6 font-display text-h3">
          {profile_title({}, { locale })}
        </h1>
        {query.data && query.userId ? (
          <ProfileForm
            key={query.userId}
            profile={query.data}
            locale={locale}
            onDirtyChange={setIsDirty}
            onReload={async () => {
              const result = await query.refetch();
              return result.isError ? undefined : result.data;
            }}
          />
        ) : (
          <ProfileAccess
            locale={locale}
            isLoading={
              query.isAuthLoading || (!!query.userId && query.isPending)
            }
            isAnonymous={!query.userId}
            returnPath={`/${locale}/profile`}
            onRetry={() => void query.refetch()}
          />
        )}
        {guard.isBlocked && (
          <div
            role="alertdialog"
            aria-label={profile_unsaved_title({}, { locale })}
            className="mt-6 rounded-box border border-base-300 bg-base-200 p-4"
          >
            <p>{profile_unsaved_title({}, { locale })}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={guard.stay}>
                {profile_unsaved_stay({}, { locale })}
              </Button>
              <Button type="button" variant="ghost" onClick={guard.leave}>
                {profile_unsaved_leave({}, { locale })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
