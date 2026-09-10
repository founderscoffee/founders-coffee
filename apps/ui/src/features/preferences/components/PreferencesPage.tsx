import { useEffect, useState } from 'react';

import {
  cookieName,
  prefs_conflict_error,
  prefs_delivery_note,
  prefs_delivery_title,
  prefs_discard,
  prefs_heading,
  prefs_loading,
  prefs_note,
  prefs_save,
  prefs_save_error,
  prefs_saved,
  prefs_saving,
  prefs_sms_consent_error,
  prefs_title,
  prefs_unavailable,
  prefs_unsaved,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';
import { appErrorCode } from '@founders-coffee/core';

import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { ProfileSectionNav } from '../../account/components/ProfileSectionNav';
import type { AccountPreferencesView } from '../api';
import {
  forgetRememberedMarket,
  marketCodeFor,
  rememberedMarket,
} from '../device-location';
import {
  draftFrom,
  hasChanges,
  localeChanged,
  toInput,
  type PreferencesDraft,
} from '../draft';
import {
  useDevicePushState,
  useMyPreferences,
  useSavePreferences,
} from '../hooks';
import {
  CategoryGroup,
  DeviceLocationGroup,
  Group,
  LanguageGroup,
  SmsRow,
} from './PreferenceGroups';
import { PushRow } from './PushRow';

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
  const [remembered, setRemembered] = useState<string | null>(null);
  const push = useDevicePushState(marketCode);
  const save = useSavePreferences();

  useEffect(() => setDraft(draftFrom(view)), [view]);
  useEffect(() => setRemembered(rememberedMarket()), []);

  const dirty = hasChanges(draft, view);
  const change = (changes: Partial<PreferencesDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const submit = () => {
    const willReload = localeChanged(draft, view);
    save.mutate(toInput(draft, view.revision), {
      onSuccess: () => {
        if (!willReload) return;
        document.cookie = `${cookieName}=${draft.locale ?? ''}; path=/; max-age=${
          draft.locale ? 31536000 : 0
        }; samesite=lax`;
        window.location.reload();
      },
    });
  };

  return (
    <div className="space-y-6">
      <LanguageGroup
        locale={locale}
        value={draft.locale}
        onChange={(next) => change({ locale: next })}
      />

      <CategoryGroup locale={locale} draft={draft} onChange={change} />

      <Group
        title={prefs_delivery_title({}, { locale })}
        note={prefs_delivery_note({}, { locale })}
      >
        <PushRow
          locale={locale}
          state={push.state}
          isEnabling={push.isEnabling}
          onEnable={() => void push.enable()}
        />
        <SmsRow
          locale={locale}
          checked={draft.smsFallbackEnabled}
          available={view.smsAvailable}
          consentAt={view.smsConsentAt}
          onChange={(smsFallbackEnabled) => change({ smsFallbackEnabled })}
        />
      </Group>

      <DeviceLocationGroup
        locale={locale}
        remembered={remembered}
        onForget={() => {
          forgetRememberedMarket();
          setRemembered(null);
        }}
      />

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 p-4">
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
            {prefs_discard({}, { locale })}
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
    <section className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="mb-1 font-display text-h3">
        {prefs_title({}, { locale })}
      </h1>
      <p className="mb-6 text-body-sm text-neutral">
        {prefs_heading({}, { locale })} {prefs_note({}, { locale })}
      </p>
      <ProfileSectionNav locale={locale} />

      {query.data ? (
        <PreferencesForm
          locale={locale}
          marketCode={marketCodeFor(markets)}
          view={query.data}
        />
      ) : query.isError && query.userId ? (
        <p role="alert" className="text-body-sm text-error">
          {prefs_unavailable({}, { locale })}
        </p>
      ) : isLoading ? (
        <p role="status">{prefs_loading({}, { locale })}</p>
      ) : (
        <ProfileAccess
          locale={locale}
          isLoading={false}
          isAnonymous={!query.userId}
          returnPath="/preferences"
          onRetry={() => void query.refetch()}
        />
      )}
    </section>
  );
};
