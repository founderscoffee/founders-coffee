import { Link } from '@tanstack/react-router';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  host_edit_error_cancelled,
  host_edit_error_conflict,
  host_edit_error_ended,
  host_edit_error_generic,
  host_edit_error_not_host,
  host_edit_loading,
  host_edit_saved,
  host_edit_title,
  host_edit_back_to_event,
  type Locale,
} from '@founders-coffee/i18n';

import { localizedEvent } from '../../../lib/locale-routing';
import { useEventById, useUpdateEvent } from '../hooks';
import {
  draftFromEvent,
  locationPatch,
  type EventEditDraft,
} from '../event-edit-draft';
import { EventEditForm } from './EventEditForm';

const messageFor = (error: unknown, locale: Locale): string => {
  const code = appErrorCode(error);
  if (code === 'event_conflict')
    return host_edit_error_conflict({}, { locale });
  if (code === 'event_already_ended')
    return host_edit_error_ended({}, { locale });
  if (code === 'event_is_cancelled')
    return host_edit_error_cancelled({}, { locale });
  if (code === 'event_not_host')
    return host_edit_error_not_host({}, { locale });
  return host_edit_error_generic({}, { locale });
};

export const EventEditPage = ({
  locale,
  eventId,
  mapboxToken,
  markets = [],
}: {
  locale: Locale;
  eventId: string;
  mapboxToken: string;
  markets?: readonly { code: string; slug: string; timezone: string }[];
}) => {
  const router = useRouter();
  const query = useEventById(eventId);
  const save = useUpdateEvent();
  const [draft, setDraft] = useState<EventEditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const event = query.data;
  const market = event
    ? markets.find((candidate) => candidate.code === event.marketCode)
    : undefined;
  const closedReason = !event
    ? null
    : event.status === 'cancelled'
      ? host_edit_error_cancelled({}, { locale })
      : event.endsAt && new Date(event.endsAt).getTime() <= Date.now()
        ? host_edit_error_ended({}, { locale })
        : null;
  const current =
    event && !closedReason ? (draft ?? draftFromEvent(event)) : null;

  const submit = () => {
    if (
      !event ||
      !current ||
      current.startsAt === null ||
      current.endsAt === null
    )
      return;
    setError(null);
    save.mutate(
      {
        data: {
          eventId: event.id,
          event: {
            expectedVersion: event.version,
            title: current.title.trim(),
            description: current.description.trim(),
            venueName: current.venueName.trim(),
            ...(locationPatch(event, current) ?? {}),
            startsAt: current.startsAt,
            endsAt: current.endsAt,
            language: event.language,
          },
        },
      },
      {
        onSuccess: () => {
          setDraft(null);
          void query.refetch();
          void router.invalidate();
        },
        onError: (cause) => setError(messageFor(cause, locale)),
      },
    );
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 font-display text-h2 font-semibold">
        {host_edit_title({}, { locale })}
      </h1>

      {query.isPending ? (
        <p role="status">{host_edit_loading({}, { locale })}</p>
      ) : !event ? (
        <p role="alert" className="text-body-sm text-error">
          {messageFor(query.error, locale)}
        </p>
      ) : !current ? (
        <p role="alert" className="text-body-sm text-error">
          {closedReason ?? messageFor(query.error, locale)}
        </p>
      ) : (
        <div className="grid gap-5">
          {save.isSuccess && !error ? (
            <p role="status" className="text-body-sm text-success">
              {host_edit_saved({}, { locale })}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-body-sm text-error">
              {error}
            </p>
          ) : null}

          <EventEditForm
            locale={locale}
            event={event}
            timezone={market?.timezone ?? 'UTC'}
            mapboxToken={mapboxToken}
            draft={current}
            onDraftChange={setDraft}
            onSubmit={submit}
            isPending={save.isPending}
            backLink={
              market ? (
                <Link
                  className="btn btn-outline w-fit"
                  {...localizedEvent(locale, market.slug, event.slug)}
                >
                  <ArrowLeft
                    className="size-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                  {host_edit_back_to_event({}, { locale })}
                </Link>
              ) : null
            }
          />
        </div>
      )}
    </section>
  );
};
