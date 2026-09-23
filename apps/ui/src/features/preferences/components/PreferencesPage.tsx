import { useEffect, useState } from 'react';

import {
  prefs_conflict_error,
  discard_changes,
  prefs_loading,
  prefs_reload,
  prefs_save,
  prefs_save_error,
  prefs_saved,
  prefs_saving,
  prefs_sms_consent_error,
  notifications_title,
  prefs_unavailable,
  prefs_unsaved,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';
import { appErrorCode } from '@founders-coffee/core';

import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { ProfileSectionNav } from '../../account/components/ProfileSectionNav';
import type { AccountPreferencesView } from '../api';
import { marketCodeFor } from '../device-location';
import {
  draftFrom,
  hasChanges,
  toInput,
  type PreferencesDraft,
} from '../draft';
import {
  useDevicePushState,
  useMyPreferences,
  useSavePreferences,
} from '../hooks';
import { CategoryGroup } from './PreferenceGroups';

const saveErrorFor = (error: unknown, locale: Locale): string => {
  const code = appErrorCode(error);
  if (code === 'preferences_conflict')
    return prefs_conflict_error({}, { locale });
  if (code === 'sms_consent_unavailable')
    return prefs_sms_consent_error({}, { locale });
  return prefs_save_error({}, { locale });
};

const PreferencesForm = ({
  locale,
  marketCode,
  view,
}: {
  locale: Locale;
  marketCode: string;
  view: AccountPreferencesView;
}) => {
  const [draft, setDraft] = useState<PreferencesDraft>(() => draftFrom(view));
  const push = useDevicePushState(marketCode);
  const save = useSavePreferences();

  useEffect(() => setDraft(draftFrom(view)), [view]);

  const dirty = hasChanges(draft, view);
  const change = (changes: Partial<PreferencesDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const submit = () => save.mutate(toInput(draft, view.revision));

  return (
    <div className="space-y-6">
      <CategoryGroup
        locale={locale}
        draft={draft}
        pushState={push.state}
        isEnabling={push.isEnabling}
        onEnablePush={push.enable}
        onChange={change}
      />

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 bg-base-100 p-4">
        <p
          className="text-body-sm text-neutral"
          role="status"
          aria-live="polite"
        >
          {save.isError
            ? saveErrorFor(save.error, locale)
            : save.isSuccess && !dirty
              ? prefs_saved({}, { locale })
              : dirty
                ? prefs_unsaved({}, { locale })
                : ''}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || save.isPending}
            onClick={() => setDraft(draftFrom(view))}
          >
            {discard_changes({}, { locale })}
          </Button>
          <Button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={submit}
          >
            {save.isPending
              ? prefs_saving({}, { locale })
              : prefs_save({}, { locale })}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const PreferencesPage = ({
  locale,
  markets,
}: {
  locale: Locale;
  markets: readonly { code: string; slug: string }[];
}) => {
  const query = useMyPreferences();
  const isLoading =
    query.isAuthLoading ||
    (!!query.userId && query.isPending && !query.isError);

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-12">
      <ProfileSectionNav locale={locale} />
      <div className="min-w-0">
        <h1 className="mb-6 font-display text-h3">
          {notifications_title({}, { locale })}
        </h1>

        {query.data ? (
          <PreferencesForm
            locale={locale}
            marketCode={marketCodeFor(markets)}
            view={query.data}
          />
        ) : query.isError && query.userId ? (
          <div className="rounded-box border border-error/30 bg-error/5 p-6">
            <p role="alert" className="text-body-sm text-error">
              {prefs_unavailable({}, { locale })}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void query.refetch()}
            >
              {prefs_reload({}, { locale })}
            </Button>
          </div>
        ) : isLoading ? (
          <p role="status">{prefs_loading({}, { locale })}</p>
        ) : (
          <ProfileAccess
            locale={locale}
            isLoading={false}
            isAnonymous={!query.userId}
            returnPath={`/${locale}/profile/notifications`}
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    </section>
  );
};
