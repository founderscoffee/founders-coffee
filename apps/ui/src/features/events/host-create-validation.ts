import { localeSchema } from '@founders-coffee/core';
import { events } from '@founders-coffee/domain';
import {
  host_capacity_constraints,
  host_desc_constraints,
  host_duration_range,
  host_schedule_required,
  host_selection_required,
  host_time_past,
  host_title_constraints,
  host_venue_required,
  type Locale,
} from '@founders-coffee/i18n';

import type { VenueSelection } from './types';
import type { HostCreateDraft } from './host-create-draft';

export type HostCreateFieldErrors = Partial<
  Record<
    | 'venue'
    | 'schedule'
    | 'title'
    | 'description'
    | 'capacity'
    | 'language'
    | 'category',
    string
  >
>;

export const validateVenueStep = (
  venue: VenueSelection | null,
  locale: Locale,
): HostCreateFieldErrors => {
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
    capacity: number;
    language: Locale;
    category: events.EventCategory;
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
  if (!events.eventCapacitySchema.safeParse(input.capacity).success) {
    errors.capacity = host_capacity_constraints(
      { max: events.EVENT_CAPACITY_MAX },
      { locale },
    );
  }
  if (!localeSchema.safeParse(input.language).success) {
    errors.language = host_selection_required({}, { locale });
  }
  if (!events.eventCategorySchema.safeParse(input.category).success) {
    errors.category = host_selection_required({}, { locale });
  }
  return errors;
};

export const firstInvalidField = (
  errors: HostCreateFieldErrors,
): keyof HostCreateFieldErrors | null =>
  (
    [
      'venue',
      'schedule',
      'title',
      'description',
      'capacity',
      'language',
      'category',
    ] as const
  ).find((field) => errors[field]) ?? null;

export const focusInvalidField = (field: keyof HostCreateFieldErrors): void => {
  const fieldIds: Record<keyof HostCreateFieldErrors, string> = {
    venue: 'venue-search',
    schedule: 'host-schedule',
    title: 'host-title',
    description: 'host-description',
    capacity: 'host-capacity',
    language: 'host-language',
    category: 'host-category',
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
  if (firstInvalidField(validateVenueStep(draft.venue, locale))) return 1;
  if (
    draft.step > 2 &&
    firstInvalidField(
      validateScheduleStep(draft.startsAt, draft.endsAt, locale),
    )
  ) {
    return 2;
  }
  if (
    draft.step > 3 &&
    firstInvalidField(
      validateDetailsStep(
        {
          title: draft.title,
          description: draft.description,
          capacity: draft.capacity,
          language: draft.language,
          category: draft.category,
        },
        locale,
      ),
    )
  ) {
    return 3;
  }
  return draft.step;
};
