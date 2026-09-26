import { useEffect, useState } from 'react';

import {
  prefs_conflict_error,
  discard_changes,
  prefs_loading,
  prefs_reload,
  prefs_save,
  prefs_save_error,
  prefs_saved,
  saving,
  prefs_sms_consent_error,
  notifications,
  prefs_unavailable,
  unsaved_changes,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, LoadingStatus, StatusMessage } from '@founders-coffee/ui';
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
  const notice = save.isError
    ? 'error'
    : save.isSuccess && !dirty
      ? 'saved'
      : dirty
        ? 'unsaved'
        : null;

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
        <div className="min-w-0">
          <StatusMessage variant="error">
            {notice === 'error' ? saveErrorFor(save.error, locale) : null}
          </StatusMessage>
          <StatusMessage variant="success">
            {notice === 'saved' ? prefs_saved({}, { locale }) : null}
          </StatusMessage>
          <StatusMessage variant="info">
            {notice === 'unsaved' ? unsaved_changes({}, { locale }) : null}
          </StatusMessage>
        </div>
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
              ? saving({}, { locale })
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
          {notifications({}, { locale })}
        </h1>

        {query.data ? (
          <PreferencesForm
            locale={locale}
            marketCode={marketCodeFor(markets)}
            view={query.data}
          />
        ) : query.isError && query.userId ? (
          <StatusMessage
            variant="error"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
              >
                {prefs_reload({}, { locale })}
              </Button>
            }
          >
            {prefs_unavailable({}, { locale })}
          </StatusMessage>
        ) : isLoading ? (
          <LoadingStatus label={prefs_loading({}, { locale })} />
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
