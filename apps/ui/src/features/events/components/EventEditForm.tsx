import { useState } from 'react';

import {
  host_edit_notice_going,
  host_edit_notice_none,
  host_edit_save,
  host_edit_saving,
  host_edit_when,
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
import { DatetimePicker } from '../../../components/host/DatetimePicker';
import { HostDetailsStep } from '../../../components/host/HostDetailsStep';

export type EventEditDraft = {
  title: string;
  description: string;
  venueName: string;
  startsAt: number | null;
  endsAt: number | null;
};

export const draftFromEvent = (event: EventDetailItem): EventEditDraft => ({
  title: event.title,
  description: event.description,
  venueName: event.venue,
  startsAt: new Date(event.startsAt).getTime(),
  endsAt: event.endsAt ? new Date(event.endsAt).getTime() : null,
});

export const hasScheduleMoved = (
  event: EventDetailItem,
  draft: EventEditDraft,
): boolean =>
  new Date(event.startsAt).getTime() !== draft.startsAt ||
  (event.endsAt ? new Date(event.endsAt).getTime() : null) !== draft.endsAt;

const scheduleMessage = (error: ZonedDateTimeError, locale: Locale): string => {
  if (error === 'nonexistent_time')
    return host_time_nonexistent({}, { locale });
  if (error === 'invalid_time_zone')
    return host_time_zone_error({}, { locale });
  return host_time_invalid({}, { locale });
};

const { constraints } = hostCreateViewCopy();

export const EventEditForm = ({
  locale,
  event,
  timezone,
  draft,
  onDraftChange,
  onSubmit,
  isPending,
}: {
  locale: Locale;
  event: EventDetailItem;
  timezone: string;
  draft: EventEditDraft;
  onDraftChange: (draft: EventEditDraft) => void;
  onSubmit: () => void;
  isPending: boolean;
}) => {
  const [scheduleError, setScheduleError] = useState<ZonedDateTimeError | null>(
    null,
  );
  const moved = hasScheduleMoved(event, draft);
  const others = Math.max(0, event.goingCount - 1);
  const willNotify = moved && others > 0;
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
        {willNotify
          ? host_edit_notice_going({ n: others }, { locale })
          : host_edit_notice_none({}, { locale })}
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
