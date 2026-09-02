import { z } from 'zod';

import { marketCodeSchema } from '@founders-coffee/core';

export const EVENT_LANGUAGES = ['ar', 'en', 'fr', 'ar_en', 'ar_fr'] as const;
export const EVENT_CATEGORIES = [
  'coffee-meetup',
  'workshop',
  'demo-day',
] as const;

export const EVENT_TITLE_MIN_LENGTH = 3;
export const EVENT_TITLE_MAX_LENGTH = 120;
export const EVENT_DESCRIPTION_MIN_LENGTH = 10;
export const EVENT_DESCRIPTION_MAX_LENGTH = 2000;
export const EVENT_VENUE_NAME_MIN_LENGTH = 2;
export const EVENT_VENUE_NAME_MAX_LENGTH = 200;
export const EVENT_VENUE_ADDRESS_MIN_LENGTH = 2;
export const EVENT_VENUE_ADDRESS_MAX_LENGTH = 500;
export const EVENT_CAPACITY_MAX = 10_000;
export const EVENT_DURATION_MINUTES_MIN = 30;
export const EVENT_DURATION_MINUTES_MAX = 8 * 60;

const MINUTE_MS = 60_000;
export const EVENT_DURATION_MS_MIN = EVENT_DURATION_MINUTES_MIN * MINUTE_MS;
export const EVENT_DURATION_MS_MAX = EVENT_DURATION_MINUTES_MAX * MINUTE_MS;

export const eventTitleSchema = z
  .string()
  .trim()
  .min(EVENT_TITLE_MIN_LENGTH)
  .max(EVENT_TITLE_MAX_LENGTH);

export const eventDescriptionSchema = z
  .string()
  .trim()
  .min(EVENT_DESCRIPTION_MIN_LENGTH)
  .max(EVENT_DESCRIPTION_MAX_LENGTH);

export const eventVenueNameSchema = z
  .string()
  .trim()
  .min(EVENT_VENUE_NAME_MIN_LENGTH)
  .max(EVENT_VENUE_NAME_MAX_LENGTH);

export const eventVenueAddressSchema = z
  .string()
  .trim()
  .min(EVENT_VENUE_ADDRESS_MIN_LENGTH)
  .max(EVENT_VENUE_ADDRESS_MAX_LENGTH);

export const eventCapacitySchema = z
  .number()
  .int()
  .min(0)
  .max(EVENT_CAPACITY_MAX);

export const eventLanguageSchema = z.enum(EVENT_LANGUAGES);
export const eventCategorySchema = z.enum(EVENT_CATEGORIES);

const addScheduleIssues = (
  input: { startsAt: number; endsAt: number },
  context: z.RefinementCtx,
) => {
  if (input.startsAt <= Date.now()) {
    context.addIssue({
      code: 'custom',
      message: 'Event start must be in the future',
      path: ['startsAt'],
    });
  }

  const duration = input.endsAt - input.startsAt;
  if (duration <= 0) {
    context.addIssue({
      code: 'custom',
      message: 'Event end must be after its start',
      path: ['endsAt'],
    });
    return;
  }
  if (duration < EVENT_DURATION_MS_MIN) {
    context.addIssue({
      code: 'custom',
      message: `Event duration must be at least ${EVENT_DURATION_MINUTES_MIN} minutes`,
      path: ['endsAt'],
    });
  }
  if (duration > EVENT_DURATION_MS_MAX) {
    context.addIssue({
      code: 'custom',
      message: `Event duration must not exceed ${EVENT_DURATION_MINUTES_MAX} minutes`,
      path: ['endsAt'],
    });
  }
};

export const eventScheduleSchema = z
  .object({
    startsAt: z.number().int().positive(),
    endsAt: z.number().int().positive(),
  })
  .superRefine(addScheduleIssues);

export const eventCreateSchema = z
  .object({
    marketCode: marketCodeSchema,
    cityCode: z.string().trim().min(1).max(32),
    title: eventTitleSchema,
    description: eventDescriptionSchema,
    venueName: eventVenueNameSchema,
    venueAddress: eventVenueAddressSchema,
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    startsAt: z.number().int().positive(),
    endsAt: z.number().int().positive(),
    capacity: eventCapacitySchema,
    language: eventLanguageSchema,
    category: eventCategorySchema,
  })
  .strict()
  .superRefine(addScheduleIssues);

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventLanguage = z.infer<typeof eventLanguageSchema>;
export type EventCategory = z.infer<typeof eventCategorySchema>;
