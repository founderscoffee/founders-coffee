import { hasVenueMoved } from '@founders-coffee/core';
import type { Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import type { VenueSelection } from './types';

const MAX_ADDRESS_LENGTH = 500;
const MAX_PROVIDER_ID_LENGTH = 120;

export type EventEditDraft = {
  title: string;
  description: string;
  venueName: string;
  venue: VenueSelection | null;
  venueSearch: string;
  startsAt: number | null;
  endsAt: number | null;
  language: Locale;
};

export type EventLocationPatch = {
  latitude: number;
  longitude: number;
  venueAddress?: string;
  venueProviderId?: string;
};

/**
 * The meetup's stored point, dressed as something the map and the venue list can show.
 *
 * The picker was written for creation, where a venue is chosen from nothing, so it only knows how
 * to display a selection. An event being edited already has one, and a map that opened empty over
 * the middle of the city would ask the host to find their own café again before they could move it.
 *
 * `providerId` is invented here because the stored row does not keep one. It never leaves the
 * browser: the only thing that reads it is the list, to mark which row is selected, and a patch
 * built from an unmoved pin is discarded before it reaches the wire.
 */
export const storedPin = (event: EventDetailItem): VenueSelection | null =>
  event.latitude !== null && event.longitude !== null
    ? {
        providerId: `event:${event.id}`,
        kind: 'address',
        name: event.venue,
        address: event.venueAddress ?? '',
        latitude: event.latitude,
        longitude: event.longitude,
      }
    : null;

export const draftFromEvent = (event: EventDetailItem): EventEditDraft => ({
  title: event.title,
  description: event.description,
  venueName: event.venue,
  venue: storedPin(event),
  venueSearch: '',
  startsAt: new Date(event.startsAt).getTime(),
  endsAt: event.endsAt ? new Date(event.endsAt).getTime() : null,
  language: event.language,
});

/**
 * Name the place the host just chose, without throwing away the one they had.
 *
 * Creation clears the name whenever the provider could only confirm a street address, so that
 * "15 Rue Yousfi Mohamed" cannot be published as if it were a venue. An edit cannot do that: the
 * meetup already carries a name people read when they booked, and emptying the field because the
 * host dragged the pin a few metres would make them retype it to save anything at all. A point of
 * interest still names itself — picking a different café means the old name is the wrong one.
 */
export const nameFor = (
  draft: EventEditDraft,
  picked: VenueSelection,
): string => (picked.kind === 'poi' ? picked.name : draft.venueName);

export const hasScheduleMoved = (
  event: EventDetailItem,
  draft: EventEditDraft,
): boolean =>
  new Date(event.startsAt).getTime() !== draft.startsAt ||
  (event.endsAt ? new Date(event.endsAt).getTime() : null) !== draft.endsAt;

export const hasPlaceMoved = (
  event: EventDetailItem,
  draft: EventEditDraft,
): boolean => draft.venue !== null && hasVenueMoved(event, draft.venue);

/**
 * The location fields a save should carry, or nothing at all when the pin did not move.
 *
 * Sending the point back unchanged is the defect this shape exists to prevent. A form that always
 * sends coordinates has to invent them for the great majority of rows that have none, and an
 * invented zero is indistinguishable from a host dragging the pin into the Gulf of Guinea — the
 * resolver geocodes it, finds no city in the market, and refuses the edit. Absence is the honest
 * way to say "where it is has not changed", so an untouched pin sends nothing.
 *
 * The address and the provider id are dropped rather than truncated when they do not fit what the
 * schema accepts. They are conveniences — the server geocodes the point again regardless — and a
 * half an address is worse than none.
 */
export const locationPatch = (
  event: EventDetailItem,
  draft: EventEditDraft,
): EventLocationPatch | null => {
  const picked = draft.venue;
  if (!picked) return null;
  if (
    picked.latitude === event.latitude &&
    picked.longitude === event.longitude
  )
    return null;
  const address = picked.address.trim();
  const providerId = picked.providerId.trim();
  return {
    latitude: picked.latitude,
    longitude: picked.longitude,
    ...(address.length >= 2 && address.length <= MAX_ADDRESS_LENGTH
      ? { venueAddress: address }
      : {}),
    ...(providerId.length >= 1 && providerId.length <= MAX_PROVIDER_ID_LENGTH
      ? { venueProviderId: providerId }
      : {}),
  };
};
