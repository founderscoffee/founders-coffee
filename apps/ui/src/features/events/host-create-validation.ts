import { events } from '@founders-coffee/domain';
import {
  host_desc_constraints,
  host_duration_range,
  host_time_past,
  host_title_constraints,
  host_venue_name_required,
  host_venue_required,
  type Locale,
} from '@founders-coffee/i18n';

import type { MeetupLanguage, VenueSelection } from './types';
import type { HostCreateDraft } from './host-create-draft';
import { seekField } from './seek-field';

export type HostCreateField =
  'venue' | 'venueName' | 'schedule' | 'title' | 'description' | 'languages';

export type HostCreateFieldErrors = Partial<Record<HostCreateField, string>>;

export type HostCreateStepCheck = Partial<
  Record<HostCreateField, string | null>
>;

const isBlank = (value: string): boolean => value.trim() === '';

/**
 * What holds the venue step back. Nothing chosen yet, or an address not named yet, is a gap
 * (null): Next takes the host to it and has nothing to say. A name too short to be one, or a
 * place the meetup cannot use, comes with the message that says why.
 */
export const validateVenueStep = (
  venue: VenueSelection | null,
  venueName: string,
  locale: Locale,
): HostCreateStepCheck => {
  if (!venue) return { venue: null };
  if (
    venue.kind === 'address' &&
    !events.eventVenueNameSchema.safeParse(venueName).success
  ) {
    return {
      venueName: isBlank(venueName)
        ? null
        : host_venue_name_required({}, { locale }),
    };
  }
  if (
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

/**
 * What holds the schedule step back: no day yet is a gap (null), and a time already gone or a
 * meetup too short or too long comes with the message that says why.
 */
export const validateScheduleStep = (
  startsAt: number | null,
  endsAt: number | null,
  locale: Locale,
): HostCreateStepCheck => {
  if (startsAt === null || endsAt === null) return { schedule: null };
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

/**
 * What holds the details step back: a title or description not written yet, or every language
 * taken off, is a gap (null); a title or description too short or too long says how long it
 * has to be.
 */
export const validateDetailsStep = (
  input: {
    title: string;
    description: string;
    languages: readonly MeetupLanguage[];
  },
  locale: Locale,
): HostCreateStepCheck => {
  const errors: HostCreateStepCheck = {};
  if (isBlank(input.title)) {
    errors.title = null;
  } else if (!events.eventTitleSchema.safeParse(input.title).success) {
    errors.title = host_title_constraints(
      {
        min: events.EVENT_TITLE_MIN_LENGTH,
        max: events.EVENT_TITLE_MAX_LENGTH,
      },
      { locale },
    );
  }
  if (isBlank(input.description)) {
    errors.description = null;
  } else if (
    !events.eventDescriptionSchema.safeParse(input.description).success
  ) {
    errors.description = host_desc_constraints(
      {
        min: events.EVENT_DESCRIPTION_MIN_LENGTH,
        max: events.EVENT_DESCRIPTION_MAX_LENGTH,
      },
      { locale },
    );
  }
  if (input.languages.length === 0) errors.languages = null;
  return errors;
};

export const firstInvalidField = (
  check: HostCreateStepCheck,
): HostCreateField | null =>
  (
    [
      'venue',
      'venueName',
      'schedule',
      'title',
      'description',
      'languages',
    ] as const
  ).find((field) => check[field] !== undefined) ?? null;

/**
 * The messages to show once Next has checked a step: the check's word on each value the host
 * gave, and nothing new on a gap. A message already on screen for a gap stays, as the time
 * picker's does until the host changes the time, and every other one goes.
 */
export const shownErrors = (
  check: HostCreateStepCheck,
  shown: HostCreateFieldErrors,
): HostCreateFieldErrors => {
  const errors: HostCreateFieldErrors = {};
  for (const field of Object.keys(check) as HostCreateField[]) {
    const message = check[field] ?? shown[field];
    if (message) errors[field] = message;
  }
  return errors;
};

const FIELD_IDS: Partial<Record<HostCreateField, string>> = {
  venueName: 'host-venue-name',
  schedule: 'host-calendar',
  title: 'host-title',
  description: 'host-description',
  languages: 'host-languages',
};

/**
 * Take the host to `field`, the first one Next found holding the step back. A field that cannot
 * take the focus itself hands it to its own tab stop, as the calendar does to the day its arrow
 * keys start from. The venue is no single field: the page offers its places instead.
 */
export const focusInvalidField = (field: HostCreateField): void => {
  const id = FIELD_IDS[field];
  const element = id ? document.getElementById(id) : null;
  if (!element) return;
  const isFocusable = element.hasAttribute('tabindex') || element.tabIndex >= 0;
  seekField(
    isFocusable
      ? element
      : (element.querySelector<HTMLElement>('[tabindex="0"]') ?? element),
  );
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
