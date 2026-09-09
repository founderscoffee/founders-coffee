import { useCallback, useEffect, useRef } from 'react';

import {
  onboarding_title,
  onboarding_subtitle,
  type Locale,
} from '@founders-coffee/i18n';

import { useMyProfile } from '../hooks';
import { ProfileAccess } from './ProfileAccess';
import { ProfileNameEditor } from './ProfileNameEditor';

export const ProfileCompletion = ({
  locale,
  returnPath,
  onComplete,
}: {
  locale: Locale;
  returnPath: string;
  onComplete: () => void;
}) => {
  const query = useMyProfile();
  const didComplete = useRef(false);
  const isMounted = useRef(false);
  const callback = useRef(onComplete);
  callback.current = onComplete;
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const complete = useCallback(() => {
    if (didComplete.current || !isMounted.current) return;
    didComplete.current = true;
    callback.current();
  }, []);
  useEffect(() => {
    if (query.data?.displayName) complete();
  }, [query.data?.displayName, complete]);
  return (
    <div className="space-y-5">
      <h2 className="font-display text-h3">
        {onboarding_title({}, { locale })}
      </h2>
      <p className="text-body-sm text-neutral">
        {onboarding_subtitle({}, { locale })}
      </p>
      {query.data && query.userId ? (
        <ProfileNameEditor
          key={query.userId}
          profile={query.data}
          locale={locale}
          onSaved={complete}
          onReload={async () => {
            const result = await query.refetch();
            return result.isError ? undefined : result.data;
          }}
        />
      ) : (
        <ProfileAccess
          locale={locale}
          isLoading={query.isAuthLoading || (!!query.userId && query.isPending)}
          isAnonymous={!query.userId}
          returnPath={returnPath}
          onRetry={() => void query.refetch()}
        />
      )}
    </div>
  );
};
