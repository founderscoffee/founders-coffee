import { useState } from 'react';

import {
  host_edit_notice_both,
  host_edit_notice_going,
  host_edit_notice_none,
  host_edit_notice_venue,
  host_edit_save,
  host_edit_saving,
  host_edit_when,
  host_edit_where,
  host_venue_name_label,
  host_venue_name_ph,
  host_time_invalid,
  host_time_nonexistent,
  host_time_zone_error,
  type Locale,
  type ZonedDateTimeError,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import { hostCreateViewCopy } from '../host-create-copy';
import {
  hasPlaceMoved,
  hasScheduleMoved,
  nameFor,
  type EventEditDraft,
} from '../event-edit-draft';
import { DatetimePicker } from '../../../components/host/DatetimePicker';
import { HostDetailsStep } from '../../../components/host/HostDetailsStep';
import { EventEditVenue } from './EventEditVenue';

const scheduleMessage = (error: ZonedDateTimeError, locale: Locale): string => {
  if (error === 'nonexistent_time')
    return host_time_nonexistent({}, { locale });
  if (error === 'invalid_time_zone')
    return host_time_zone_error({}, { locale });
  return host_time_invalid({}, { locale });
};

const noticeFor = (
  locale: Locale,
  n: number,
  timeMoved: boolean,
  placeMoved: boolean,
): string => {
  if (n === 0 || (!timeMoved && !placeMoved))
    return host_edit_notice_none({}, { locale });
  if (timeMoved && placeMoved) return host_edit_notice_both({ n }, { locale });
  if (timeMoved) return host_edit_notice_going({ n }, { locale });
  return host_edit_notice_venue({ n }, { locale });
};

const { constraints } = hostCreateViewCopy();

export const EventEditForm = ({
  locale,
  event,
  timezone,
  mapboxToken,
  draft,
  onDraftChange,
  onSubmit,
  isPending,
}: {
  locale: Locale;
  event: EventDetailItem;
  timezone: string;
  mapboxToken: string;
  draft: EventEditDraft;
  onDraftChange: (draft: EventEditDraft) => void;
  onSubmit: () => void;
  isPending: boolean;
}) => {
  const [scheduleError, setScheduleError] = useState<ZonedDateTimeError | null>(
    null,
  );
  const timeMoved = hasScheduleMoved(event, draft);
  const placeMoved = hasPlaceMoved(event, draft);
  const others = Math.max(0, event.goingCount - 1);
  const willNotify = (timeMoved || placeMoved) && others > 0;
  const patch = (next: Partial<EventEditDraft>) =>
    onDraftChange({ ...draft, ...next });

  return (
    <form
      className="grid gap-6"
      onSubmit={(submitted) => {
        submitted.preventDefault();
        onSubmit();
      }}
    >
      <HostDetailsStep
        locale={locale}
        title={draft.title}
        description={draft.description}
        constraints={constraints}
        errors={{}}
        onTitleChange={(title) => patch({ title })}
        onDescriptionChange={(description) => patch({ description })}
      />

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-display text-body-lg font-semibold">
          {host_edit_where({}, { locale })}
        </legend>
        <label className="form-control" htmlFor="edit-venue-name">
          <span className="mb-1 text-body-sm text-neutral">
            {host_venue_name_label({}, { locale })}
          </span>
          <input
            id="edit-venue-name"
            className="input input-bordered w-full"
            dir="auto"
            value={draft.venueName}
            maxLength={constraints.venueNameMax}
            placeholder={host_venue_name_ph({}, { locale })}
            onChange={(changed) => patch({ venueName: changed.target.value })}
          />
        </label>
        <EventEditVenue
          locale={locale}
          event={event}
          mapboxToken={mapboxToken}
          venue={draft.venue}
          searchValue={draft.venueSearch}
          onSearchChange={(venueSearch) => patch({ venueSearch })}
          onVenueSelect={(picked) =>
            patch({ venue: picked, venueName: nameFor(draft, picked) })
          }
          onVenueInvalidate={() => patch({ venue: null })}
        />
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 font-display text-body-lg font-semibold">
          {host_edit_when({}, { locale })}
        </legend>
        <DatetimePicker
          locale={locale}
          timeZone={timezone}
          startsAt={draft.startsAt}
          endsAt={draft.endsAt}
          onChange={(startsAt, endsAt) => patch({ startsAt, endsAt })}
          onError={setScheduleError}
        />
        {scheduleError && (
          <p role="alert" className="text-body-sm text-error">
            {scheduleMessage(scheduleError, locale)}
          </p>
        )}
      </fieldset>

      <p
        className={`text-body-sm ${willNotify ? 'text-warning' : 'text-neutral'}`}
        aria-live="polite"
      >
        {noticeFor(locale, others, timeMoved, placeMoved)}
      </p>

      <Button
        type="submit"
        className="btn btn-primary w-fit"
        disabled={isPending || scheduleError !== null}
      >
        {isPending
          ? host_edit_saving({}, { locale })
          : host_edit_save({}, { locale })}
      </Button>
    </form>
  );
};
