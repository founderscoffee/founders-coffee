import type {
  EventFeedItem,
  EventWithAttendance,
  HostMapContext,
  VenueCandidate,
} from './api';

export type EventView = EventFeedItem;
export type EventDetailView = EventWithAttendance;
export type HostMapViewport = HostMapContext;
export type VenueSelection = VenueCandidate;
export type VenueArea = {
  readonly kind: 'city' | 'market';
  readonly name: string;
};

export const VENUE_SEARCH_MAX_LENGTH = 500;
