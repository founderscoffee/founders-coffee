import { z } from 'zod';

import { venueKindSchema } from '@founders-coffee/core';
import { events, profile } from '@founders-coffee/domain';

import {
  VENUE_SEARCH_MAX_LENGTH,
  type MeetupLanguage,
  type VenueSelection,
} from './types';

const DRAFT_VERSION = 5;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60_000;
const REPEAT_ID_MAX_LENGTH = 64;

const venueSelectionSchema = z.object({
  providerId: z.string().min(1),
  kind: venueKindSchema,
  name: events.eventVenueNameSchema,
  address: events.eventVenueAddressSchema,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const hostCreateDraftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  savedAt: z.number().int().positive(),
  marketCode: z.string().min(1),
  step: z.number().int().min(1).max(3),
  venue: venueSelectionSchema.nullable(),
  venueName: z.string().max(events.EVENT_VENUE_NAME_MAX_LENGTH),
  searchValue: z.string().max(VENUE_SEARCH_MAX_LENGTH),
  startsAt: z.number().int().positive().nullable(),
  endsAt: z.number().int().positive().nullable(),
  title: z.string().max(events.EVENT_TITLE_MAX_LENGTH),
  description: z.string().max(events.EVENT_DESCRIPTION_MAX_LENGTH),
  chosenLanguages: z
    .array(profile.spokenLanguageSchema)
    .max(profile.SPOKEN_LANGUAGES.length)
    .nullable()
    .default(null),
  repeatOf: z
    .string()
    .min(1)
    .max(REPEAT_ID_MAX_LENGTH)
    .nullable()
    .default(null),
});

export type HostCreateDraft = {
  step: number;
  venue: VenueSelection | null;
  venueName: string;
  searchValue: string;
  startsAt: number | null;
  endsAt: number | null;
  title: string;
  description: string;
  chosenLanguages: MeetupLanguage[] | null;
};

const draftKey = (marketCode: string): string => `fc:event-draft:${marketCode}`;

/**
 * The draft saved for this market, while it is still good.
 *
 * A repeat takes only a draft saved for that same repeat (`repeatOf`, the meetup it repeats). It
 * used to take none and apply the old meetup on every load, so any reload of a repeat, the host's
 * own or a phone bringing a discarded tab back, put the old meetup back over everything the host
 * had changed. A plain wizard still takes whatever draft its market holds, a repeat's included.
 */
export const readHostCreateDraft = (
  marketCode: string,
  repeatOf?: string,
): HostCreateDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(draftKey(marketCode));
    if (!stored) return null;
    const parsed = hostCreateDraftSchema.safeParse(JSON.parse(stored));
    if (
      !parsed.success ||
      parsed.data.marketCode !== marketCode ||
      Date.now() - parsed.data.savedAt > DRAFT_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(draftKey(marketCode));
      return null;
    }
    if (repeatOf !== undefined && parsed.data.repeatOf !== repeatOf) {
      return null;
    }
    return {
      step: parsed.data.step,
      venue: parsed.data.venue,
      venueName: parsed.data.venueName,
      searchValue: parsed.data.searchValue,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      title: parsed.data.title,
      description: parsed.data.description,
      chosenLanguages: parsed.data.chosenLanguages,
    };
  } catch {
    return null;
  }
};

/**
 * Persist the draft, clamping anything the read schema would reject.
 *
 * The reader deletes a draft it cannot parse, which is right for a tampered or outdated one but
 * catastrophic for a draft this module wrote itself: an over-long venue search string used to take
 * the title, description, schedule and venue down with it. Writing only what can be read back is
 * what makes the delete-on-malformed rule safe to keep.
 */
export const writeHostCreateDraft = (
  marketCode: string,
  draft: HostCreateDraft,
  repeatOf: string | null = null,
): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      draftKey(marketCode),
      JSON.stringify({
        version: DRAFT_VERSION,
        savedAt: Date.now(),
        marketCode,
        ...draft,
        venueName: draft.venueName.slice(0, events.EVENT_VENUE_NAME_MAX_LENGTH),
        searchValue: draft.searchValue.slice(0, VENUE_SEARCH_MAX_LENGTH),
        repeatOf:
          repeatOf && repeatOf.length <= REPEAT_ID_MAX_LENGTH ? repeatOf : null,
      }),
    );
  } catch {
    return;
  }
};

export const clearHostCreateDraft = (marketCode: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(draftKey(marketCode));
  } catch {
    return;
  }
};
