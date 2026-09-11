import { useEffect, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  closeout_already_done,
  closeout_done,
  closeout_error_already_closed,
  closeout_error_cancelled,
  closeout_error_disabled,
  closeout_error_generic,
  closeout_error_not_ended,
  closeout_error_not_host,
  closeout_loading,
  closeout_note,
  closeout_refused_marks,
  closeout_submit,
  closeout_submitting,
  closeout_title,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { canSubmit, draftFrom, toRequest, type CloseoutDraft } from '../draft';
import { useCloseout, useSubmitCloseout } from '../hooks';
import { CloseoutForm } from './CloseoutForm';

const messageFor = (error: unknown, locale: Locale): string => {
  const code = appErrorCode(error);
  if (code === 'closeout_not_host')
    return closeout_error_not_host({}, { locale });
  if (code === 'closeout_not_ended')
    return closeout_error_not_ended({}, { locale });
  if (code === 'closeout_already_closed')
    return closeout_error_already_closed({}, { locale });
  if (code === 'closeout_event_cancelled')
    return closeout_error_cancelled({}, { locale });
  if (code === 'operations_disabled')
    return closeout_error_disabled({}, { locale });
  return closeout_error_generic({}, { locale });
};

export const CloseoutPage = ({
  locale,
  eventId,
}: {
  locale: Locale;
  eventId: string;
}) => {
  const query = useCloseout(eventId);
  const save = useSubmitCloseout(eventId);
  const [draft, setDraft] = useState<CloseoutDraft | null>(null);

  useEffect(() => {
    if (query.data) setDraft(draftFrom(query.data));
  }, [query.data]);

  if (!query.userId && !query.isAuthLoading)
    return (
      <section className="mx-auto max-w-2xl px-5 py-12">
        <ProfileAccess
          locale={locale}
          isLoading={false}
          isAnonymous
          returnPath={`/closeout/${eventId}`}
          onRetry={() => void query.refetch()}
        />
      </section>
    );

  return (
    <section className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="mb-1 font-display text-h3">
        {closeout_title({}, { locale })}
      </h1>
      <p className="mb-6 text-body-sm text-neutral">
        {closeout_note({}, { locale })}
      </p>

      {query.isError ? (
        <p className="text-body-sm text-error" role="alert">
          {messageFor(query.error, locale)}
        </p>
      ) : !query.data || !draft ? (
        <p role="status">{closeout_loading({}, { locale })}</p>
      ) : query.data.outcome !== null ? (
        <p role="status">{closeout_already_done({}, { locale })}</p>
      ) : save.isSuccess ? (
        <div className="space-y-3">
          <p role="status">{closeout_done({}, { locale })}</p>
          {save.data.refusedMarks.length > 0 && (
            <p className="text-body-sm text-neutral" role="alert">
              {closeout_refused_marks({}, { locale })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <CloseoutForm
            locale={locale}
            view={query.data}
            draft={draft}
            onChange={(changes) =>
              setDraft((current) =>
                current ? { ...current, ...changes } : current,
              )
            }
          />

          {save.isError && (
            <p className="text-body-sm text-error" role="alert">
              {messageFor(save.error, locale)}
            </p>
          )}

          <Button
            type="button"
            disabled={!canSubmit(draft) || save.isPending}
            onClick={() => save.mutate(toRequest(eventId, draft))}
          >
            {save.isPending
              ? closeout_submitting({}, { locale })
              : closeout_submit({}, { locale })}
          </Button>
        </div>
      )}
    </section>
  );
};
