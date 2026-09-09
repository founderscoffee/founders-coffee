import {
  cancelEvent,
  cancelRsvp,
  createEvent,
  createRsvp,
  getCity,
  getEvent,
  getHostedEvents,
  getHostMapContext,
  getMapboxToken,
  getMarket,
  getPublicAuthConfig,
  getUpcomingEvents,
  listNearbyVenues,
  reverseEventVenue,
  searchEventVenues,
  type EventCancelRequestInput,
  type EventCreateRequestInput,
  type EventFeedItem,
  type EventFeedPage,
  type HostedEventPage,
  type EventWithAttendance,
  type HostMapContext,
  type VenueCandidate,
} from '@founders-coffee/server-fns';
import type { Event } from '@founders-coffee/db';

export const eventsApi = {
  getUpcomingEvents,
  createEvent,
  getEvent,
  getHostedEvents,
  createRsvp,
  cancelRsvp,
  cancelEvent,
  getHostMapContext,
  listNearbyVenues,
  searchEventVenues,
  reverseEventVenue,
  getMarket,
  getCity,
  getMapboxToken,
  getPublicAuthConfig,
};

export type {
  EventCancelRequestInput,
  EventCreateRequestInput,
  EventFeedItem,
  EventFeedPage,
  HostedEventPage,
  EventWithAttendance,
  HostMapContext,
  VenueCandidate,
};
export type CreateEventInput = { data: EventCreateRequestInput };
export type CreatedEvent = Event;
export type RsvpInput = { data: { eventId: string } };
export type CancelEventInput = { data: EventCancelRequestInput };
export type HostMapLocationInput = {
  marketCode: string;
  cityCode?: string;
  locale: 'ar' | 'fr' | 'en';
};
export type NearbyVenuesInput = {
  marketCode: string;
  latitude: number;
  longitude: number;
};
export type VenueSearchInput = HostMapLocationInput & { query: string };
export type VenueReverseInput = HostMapLocationInput & {
  latitude: number;
  longitude: number;
};
