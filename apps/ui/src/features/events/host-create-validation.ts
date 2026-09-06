import { events } from '@founders-coffee/domain';
import {
  host_desc_constraints,
  host_duration_range,
  host_schedule_required,
  host_time_past,
  host_title_constraints,
  host_venue_name_required,
  host_venue_required,
  type Locale,
} from '@founders-coffee/i18n';

import type { VenueSelection } from './types';
import type { HostCreateDraft } from './host-create-draft';

export type HostCreateFieldErrors = Partial<
  Record<'venue' | 'venueName' | 'schedule' | 'title' | 'description', string>
>;

export const validateVenueStep = (
  venue: VenueSelection | null,
  venueName: string,
  locale: Locale,
): HostCreateFieldErrors => {
  if (
    venue &&
    venue.kind === 'address' &&
    !events.eventVenueNameSchema.safeParse(venueName).success
  ) {
    return { venueName: host_venue_name_required({}, { locale }) };
  }
  if (
    !venue ||
    !events.eventVenueNameSchema.safeParse(venue.name).success ||
    !events.eventVenueAddressSchema.safeParse(venue.address).success ||
    !Number.isFinite(venue.latitude) ||
    !Number.isFinite(venue.longitude) ||
    venue.latitude < -90 ||
    venue.latitude > 90 ||
    venue.longitude < -180 ||
    venue.longitude > 180
  ) {
    return { venue: host_venue_required({}, { locale }) };
  }
  return {};
};

export const validateScheduleStep = (
  startsAt: number | null,
  endsAt: number | null,
  locale: Locale,
): HostCreateFieldErrors => {
  if (startsAt === null || endsAt === null) {
    return { schedule: host_schedule_required({}, { locale }) };
  }
  const result = events.eventScheduleSchema.safeParse({ startsAt, endsAt });
  if (result.success) return {};
  if (startsAt <= Date.now()) {
    return { schedule: host_time_past({}, { locale }) };
  }
  return {
    schedule: host_duration_range(
      {
        min: events.EVENT_DURATION_MINUTES_MIN,
        max: events.EVENT_DURATION_MINUTES_MAX,
      },
      { locale },
    ),
  };
};

export const validateDetailsStep = (
  input: {
    title: string;
    description: string;
  },
  locale: Locale,
): HostCreateFieldErrors => {
  const errors: HostCreateFieldErrors = {};
  if (!events.eventTitleSchema.safeParse(input.title).success) {
    errors.title = host_title_constraints(
      {
        min: events.EVENT_TITLE_MIN_LENGTH,
        max: events.EVENT_TITLE_MAX_LENGTH,
      },
      { locale },
    );
  }
  if (!events.eventDescriptionSchema.safeParse(input.description).success) {
    errors.description = host_desc_constraints(
      {
        min: events.EVENT_DESCRIPTION_MIN_LENGTH,
        max: events.EVENT_DESCRIPTION_MAX_LENGTH,
      },
      { locale },
    );
  }
  return errors;
};

export const firstInvalidField = (
  errors: HostCreateFieldErrors,
): keyof HostCreateFieldErrors | null =>
  (['venue', 'venueName', 'schedule', 'title', 'description'] as const).find(
    (field) => errors[field],
  ) ?? null;

export const focusInvalidField = (field: keyof HostCreateFieldErrors): void => {
  const fieldIds: Record<keyof HostCreateFieldErrors, string> = {
    venue: 'venue-search',
    venueName: 'host-venue-name',
    schedule: 'host-schedule',
    title: 'host-title',
    description: 'host-description',
  };
  window.requestAnimationFrame(() => {
    const element = document.getElementById(fieldIds[field]);
    element?.focus();
    element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  });
};

export const restoredDraftStep = (
  draft: HostCreateDraft,
  locale: Locale,
): number => {
  if (
    firstInvalidField(validateVenueStep(draft.venue, draft.venueName, locale))
  )
    return 1;
  if (
    draft.step > 2 &&
    firstInvalidField(
      validateScheduleStep(draft.startsAt, draft.endsAt, locale),
    )
  ) {
    return 2;
  }
  return draft.step;
};
