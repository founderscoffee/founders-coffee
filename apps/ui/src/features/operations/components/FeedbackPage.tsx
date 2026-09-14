import { useEffect, useRef, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  feedback_city_discovery,
  feedback_error_disabled,
  feedback_error_generic,
  feedback_error_not_attended,
  feedback_error_not_found,
  feedback_error_not_invited,
  feedback_error_window_closed,
  feedback_loading,
  feedback_next_event,
  feedback_note,
  feedback_privacy,
  feedback_saved,
  feedback_submit,
  feedback_submitting,
  feedback_title,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Turnstile } from '@founders-coffee/ui';

import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { usePublicAuthConfig } from '../../auth/hooks';
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
  if (code === 'feedback_not_attended')
    return feedback_error_not_attended({}, { locale });
  if (code === 'feedback_not_invited')
    return feedback_error_not_invited({}, { locale });
  if (code === 'feedback_window_closed')
    return feedback_error_window_closed({}, { locale });
  if (code === 'operations_disabled')
    return feedback_error_disabled({}, { locale });
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
  const authConfig = usePublicAuthConfig();
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const bypassed = authConfig.data?.isTurnstileBypassed === true;
  const verified = bypassed || token !== null;

  useEffect(() => {
    if (query.data) setDraft(draftFromFeedback(query.data));
  }, [query.data]);
  useEffect(() => {
    if (save.isError) {
      setToken(null);
      setResetKey((value) => value + 1);
      errorRef.current?.focus();
    }
  }, [save.isError]);

  if (!query.userId && !query.isAuthLoading)
    return (
      <section className="mx-auto max-w-2xl px-5 py-12">
        <ProfileAccess
          locale={locale}
          isLoading={false}
          isAnonymous
          returnPath={`/feedback/${eventId}`}
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
  if (!query.data || !draft)
    return (
      <section className="mx-auto max-w-2xl px-5 py-12">
        <p role="status">{feedback_loading({}, { locale })}</p>
      </section>
    );

  const closed = query.data.status === 'window_closed';
  const onSubmit = () => {
    if (!canSubmitFeedback(draft) || !verified || closed) return;
    save.mutate({
      ...toFeedbackRequest(eventId, draft),
      turnstileToken: token ?? undefined,
    });
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
        <p role="status">{feedback_error_window_closed({}, { locale })}</p>
      ) : save.isSuccess ? (
        <div className="space-y-4">
          <p className="text-success" role="status">
            {feedback_saved({}, { locale })}
          </p>
          {query.data.nextEvent ? (
            <a
              className="link link-primary"
              href={`/${query.data.marketSlug}/e/${query.data.nextEvent.slug}`}
            >
              {feedback_next_event({}, { locale })}
            </a>
          ) : query.data.citySlug ? (
            <a
              className="link link-primary"
              href={`/${query.data.marketSlug}/${query.data.citySlug}`}
            >
              {feedback_city_discovery({}, { locale })}
            </a>
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
          {authConfig.data?.turnstileSiteKey && !bypassed && (
            <Turnstile
              sitekey={authConfig.data.turnstileSiteKey}
              action="submit_feedback"
              appearance="interaction-only"
              resetKey={resetKey}
              onToken={setToken}
            />
          )}
          {save.isError && (
            <p
              className="text-body-sm text-error"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              {messageFor(save.error, locale)}
            </p>
          )}
          <Button
            type="button"
            disabled={!canSubmitFeedback(draft) || !verified || save.isPending}
            onClick={onSubmit}
          >
            {save.isPending
              ? feedback_submitting({}, { locale })
              : feedback_submit({}, { locale })}
          </Button>
        </div>
      )}
    </section>
  );
};
