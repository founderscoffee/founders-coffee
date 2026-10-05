import { z } from 'zod';

import { venueKindSchema } from '@founders-coffee/core';
import { profile } from '@founders-coffee/domain';

import type { EventEditDraft } from './event-edit-draft';

const KEPT_EDIT_VERSION = 1;
const KEPT_EDIT_MAX_AGE_MS = 24 * 60 * 60_000;

const keptVenueSchema = z.object({
  providerId: z.string(),
  kind: venueKindSchema,
  name: z.string(),
  address: z.string(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const keptEditSchema = z.object({
  version: z.literal(KEPT_EDIT_VERSION),
  savedAt: z.number().int().positive(),
  eventId: z.string().min(1),
  eventVersion: z.number().int(),
  title: z.string(),
  description: z.string(),
  venueName: z.string(),
  venue: keptVenueSchema.nullable(),
  venueSearch: z.string(),
  startsAt: z.number().int().positive().nullable(),
  endsAt: z.number().int().positive().nullable(),
  languages: z
    .array(profile.spokenLanguageSchema)
    .max(profile.SPOKEN_LANGUAGES.length),
});

const keptEditKey = (eventId: string): string => `fc:event-edit:${eventId}`;

/**
 * The changes a host made to this meetup and has not saved yet, while they still apply to it.
 *
 * The form used to hold them in memory alone, so any reload took them, the host's own or a phone
 * bringing a discarded tab back. They are kept for the tab now, as the wizard keeps its draft.
 *
 * Changes made to an earlier version of the meetup are dropped. Laid over the meetup as it is now,
 * they would put back whatever that later version changed the moment the host saved. The checks
 * are loose on purpose: these are the host's own unsaved values, which the save validates, and a
 * pin the form made from the stored row can carry an empty address that a venue schema refuses.
 */
export const readEventEditDraft = (
  eventId: string,
  eventVersion: number,
): EventEditDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(keptEditKey(eventId));
    if (!stored) return null;
    const parsed = keptEditSchema.safeParse(JSON.parse(stored));
    if (
      !parsed.success ||
      parsed.data.eventId !== eventId ||
      parsed.data.eventVersion !== eventVersion ||
      Date.now() - parsed.data.savedAt > KEPT_EDIT_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(keptEditKey(eventId));
      return null;
    }
    return {
      title: parsed.data.title,
      description: parsed.data.description,
      venueName: parsed.data.venueName,
      venue: parsed.data.venue,
      venueSearch: parsed.data.venueSearch,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      languages: parsed.data.languages,
    };
  } catch {
    return null;
  }
};

export const writeEventEditDraft = (
  eventId: string,
  eventVersion: number,
  draft: EventEditDraft,
): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      keptEditKey(eventId),
      JSON.stringify({
        version: KEPT_EDIT_VERSION,
        savedAt: Date.now(),
        eventId,
        eventVersion,
        ...draft,
      }),
    );
  } catch {
    return;
  }
};

export const clearEventEditDraft = (eventId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(keptEditKey(eventId));
  } catch {
    return;
  }
};
