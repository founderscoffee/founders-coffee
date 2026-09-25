import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  feedback_city_discovery,
  feature_unavailable_region,
  feedback_error_generic,
  feedback_error_is_host,
  feedback_error_not_attended,
  feedback_error_not_found,
  feedback_error_not_invited,
  feedback_error_window_closed,
  feedback_next_event,
  feedback_note,
  feedback_privacy,
  feedback_saved,
  sending,
  feedback_title,
  loading,
  submit,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, LoadingStatus, StatusMessage } from '@founders-coffee/ui';

import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { localizedCity, localizedEvent } from '../../../lib/locale-routing';
import {
  canSubmitFeedback,
  draftFromFeedback,
  toFeedbackRequest,
  type FeedbackDraft,
} from '../feedback-draft';
import { useFeedback, useSubmitFeedback } from '../hooks';
import { FeedbackForm } from './FeedbackForm';

const messageFor = (error: unknown, locale: Locale): string => {
  const code = appErrorCode(error);
  if (code === 'feedback_is_host')
    return feedback_error_is_host({}, { locale });
  if (code === 'feedback_not_attended')
    return feedback_error_not_attended({}, { locale });
  if (code === 'feedback_not_invited')
    return feedback_error_not_invited({}, { locale });
  if (code === 'feedback_window_closed')
    return feedback_error_window_closed({}, { locale });
  if (code === 'operations_disabled')
    return feature_unavailable_region({}, { locale });
  if (code === 'event_not_found')
    return feedback_error_not_found({}, { locale });
  return feedback_error_generic({}, { locale });
};

export const FeedbackPage = ({
  locale,
  eventId,
}: {
  locale: Locale;
  eventId: string;
}) => {
  const query = useFeedback(eventId);
  const save = useSubmitFeedback(eventId);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.data) setDraft(draftFromFeedback(query.data));
  }, [query.data]);
  useEffect(() => {
    if (save.isError) errorRef.current?.focus();
  }, [save.isError]);

  if (!query.userId && !query.isAuthLoading)
    return (
      <section className="mx-auto max-w-2xl px-5 py-12">
        <ProfileAccess
          locale={locale}
          isLoading={false}
          isAnonymous
          returnPath={`/${locale}/feedback/${eventId}`}
          onRetry={() => void query.refetch()}
        />
      </section>
    );
  if (query.isError)
    return (
      <section className="mx-auto max-w-2xl px-5 py-12">
        <StatusMessage variant="error">
          {messageFor(query.error, locale)}
        </StatusMessage>
      </section>
    );
  if (!query.data || !draft)
    return (
      <section className="mx-auto max-w-2xl px-5 py-12">
        <LoadingStatus label={loading({}, { locale })} />
      </section>
    );

  const closed = query.data.status === 'window_closed';
  const onSubmit = () => {
    if (!canSubmitFeedback(draft) || closed) return;
    save.mutate(toFeedbackRequest(eventId, draft));
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6 px-5 py-12">
      <header>
        <h1 className="font-display text-h3">
          {feedback_title({}, { locale })}
        </h1>
        <p className="mt-2 text-body-sm text-neutral">
          {feedback_note({}, { locale })}
        </p>
        <p className="mt-1 text-body-sm text-neutral">
          {feedback_privacy({}, { locale })}
        </p>
      </header>
      {closed ? (
        <StatusMessage variant="info">
          {feedback_error_window_closed({}, { locale })}
        </StatusMessage>
      ) : save.isSuccess ? (
        <div className="space-y-4">
          <StatusMessage variant="success">
            {feedback_saved({}, { locale })}
          </StatusMessage>
          {query.data.nextEvent ? (
            <Link
              className="link link-primary"
              {...localizedEvent(
                locale,
                query.data.marketSlug,
                query.data.nextEvent.slug,
              )}
            >
              {feedback_next_event({}, { locale })}
            </Link>
          ) : query.data.citySlug ? (
            <Link
              className="link link-primary"
              {...localizedCity(
                locale,
                query.data.marketSlug,
                query.data.citySlug,
              )}
            >
              {feedback_city_discovery({}, { locale })}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          <FeedbackForm
            locale={locale}
            draft={draft}
            onChange={(changes) =>
              setDraft((current) =>
                current ? { ...current, ...changes } : current,
              )
            }
          />
          {save.isError && (
            <StatusMessage variant="error" ref={errorRef} tabIndex={-1}>
              {messageFor(save.error, locale)}
            </StatusMessage>
          )}
          <Button
            type="button"
            disabled={!canSubmitFeedback(draft) || save.isPending}
            onClick={onSubmit}
          >
            {save.isPending
              ? sending({}, { locale })
              : submit({}, { locale })}
          </Button>
        </div>
      )}
    </section>
  );
};
