import { z } from 'zod';

import { localeSchema } from '@founders-coffee/core';
import { events } from '@founders-coffee/domain';
import type { Locale } from '@founders-coffee/i18n';

import { VENUE_SEARCH_MAX_LENGTH, type VenueSelection } from './types';

const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60_000;

const venueSelectionSchema = z.object({
  providerId: z.string().min(1),
  name: events.eventVenueNameSchema,
  address: events.eventVenueAddressSchema,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const hostCreateDraftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  savedAt: z.number().int().positive(),
  marketCode: z.string().min(1),
  cityCode: z.string().min(1),
  step: z.number().int().min(1).max(4),
  venue: venueSelectionSchema.nullable(),
  searchValue: z.string().max(VENUE_SEARCH_MAX_LENGTH),
  startsAt: z.number().int().positive().nullable(),
  endsAt: z.number().int().positive().nullable(),
  title: z.string().max(events.EVENT_TITLE_MAX_LENGTH),
  description: z.string().max(events.EVENT_DESCRIPTION_MAX_LENGTH),
  capacity: events.eventCapacitySchema,
  language: localeSchema,
  category: events.eventCategorySchema,
});

export type HostCreateDraft = {
  step: number;
  venue: VenueSelection | null;
  searchValue: string;
  startsAt: number | null;
  endsAt: number | null;
  title: string;
  description: string;
  capacity: number;
  language: Locale;
  category: events.EventCategory;
};

const draftKey = (marketCode: string, cityCode: string): string =>
  `fc:event-draft:${marketCode}:${cityCode}`;

export const readHostCreateDraft = (
  marketCode: string,
  cityCode: string,
): HostCreateDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(
      draftKey(marketCode, cityCode),
    );
    if (!stored) return null;
    const parsed = hostCreateDraftSchema.safeParse(JSON.parse(stored));
    if (
      !parsed.success ||
      parsed.data.marketCode !== marketCode ||
      parsed.data.cityCode !== cityCode ||
      Date.now() - parsed.data.savedAt > DRAFT_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(draftKey(marketCode, cityCode));
      return null;
    }
    return {
      step: parsed.data.step,
      venue: parsed.data.venue,
      searchValue: parsed.data.searchValue,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      title: parsed.data.title,
      description: parsed.data.description,
      capacity: parsed.data.capacity,
      language: parsed.data.language,
      category: parsed.data.category,
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
  cityCode: string,
  draft: HostCreateDraft,
): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      draftKey(marketCode, cityCode),
      JSON.stringify({
        version: DRAFT_VERSION,
        savedAt: Date.now(),
        marketCode,
        cityCode,
        ...draft,
        searchValue: draft.searchValue.slice(0, VENUE_SEARCH_MAX_LENGTH),
      }),
    );
  } catch {
    return;
  }
};

export const clearHostCreateDraft = (
  marketCode: string,
  cityCode: string,
): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(draftKey(marketCode, cityCode));
  } catch {
    return;
  }
};
