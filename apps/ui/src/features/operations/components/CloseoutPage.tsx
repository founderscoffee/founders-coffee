import { useEffect, useRef, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  closeout_already_done,
  closeout_done,
  closeout_error_already_closed,
  closeout_error_cancelled,
  closeout_error_disabled,
  closeout_error_generic,
  closeout_error_no_end_time,
  closeout_error_not_ended,
  closeout_error_not_found,
  closeout_error_rate_limited,
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
import { RepeatHostLink } from '../../../components/events/RepeatHostLink';
import { useRepeatEventTemplate } from '../../events/hooks';
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
  if (code === 'closeout_no_end_time')
    return closeout_error_no_end_time({}, { locale });
  if (code === 'event_not_found')
    return closeout_error_not_found({}, { locale });
  if (code === 'rate_limited')
    return closeout_error_rate_limited({}, { locale });
  return closeout_error_generic({}, { locale });
};

export const CloseoutPage = ({
  locale,
  eventId,
  markets = [],
}: {
  locale: Locale;
  eventId: string;
  markets?: readonly { code: string; slug: string }[];
}) => {
  const query = useCloseout(eventId);
  const save = useSubmitCloseout(eventId);
  const [draft, setDraft] = useState<CloseoutDraft | null>(null);
  const refusal = useRef<HTMLParagraphElement>(null);
  const repeat = useRepeatEventTemplate(
    eventId,
    save.isSuccess && draft?.outcome === 'held',
  );
  const repeatMarketSlug = repeat.data
    ? markets.find((market) => market.code === repeat.data?.marketCode)?.slug
    : undefined;

  useEffect(() => {
    if (query.data) setDraft(draftFrom(query.data));
  }, [query.data]);

  useEffect(() => {
    if (save.isError) refusal.current?.focus();
  }, [save.isError]);

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

  if (query.isError)
    return (
      <section className="mx-auto max-w-2xl px-5 py-12">
        <p className="text-body-sm text-error" role="alert">
          {messageFor(query.error, locale)}
        </p>
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

      {!query.data || !draft ? (
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
          {draft.outcome === 'held' && repeat.data && repeatMarketSlug ? (
            <RepeatHostLink
              locale={locale}
              marketSlug={repeatMarketSlug}
              cityCode={repeat.data.cityCode}
              eventId={eventId}
            />
          ) : null}
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
            <p
              className="text-body-sm text-error"
              ref={refusal}
              role="alert"
              tabIndex={-1}
            >
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
