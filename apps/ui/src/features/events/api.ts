import {
  cancelRsvp,
  createEvent,
  createRsvp,
  getCity,
  getEvent,
  getHostMapContext,
  getMapboxToken,
  getMarket,
  getPublicAuthConfig,
  getUpcomingEvents,
  reverseEventVenue,
  searchEventVenues,
  type EventCreateRequestInput,
  type EventFeedItem,
  type EventFeedPage,
  type EventWithAttendance,
  type HostMapContext,
  type VenueCandidate,
} from '@founders-coffee/server-fns';
import type { Event } from '@founders-coffee/db';

export const eventsApi = {
  getUpcomingEvents,
  createEvent,
  getEvent,
  createRsvp,
  cancelRsvp,
  getHostMapContext,
  searchEventVenues,
  reverseEventVenue,
  getMarket,
  getCity,
  getMapboxToken,
  getPublicAuthConfig,
};

export type {
  EventCreateRequestInput,
  EventFeedItem,
  EventFeedPage,
  EventWithAttendance,
  HostMapContext,
  VenueCandidate,
};
export type CreateEventInput = { data: EventCreateRequestInput };
export type CreatedEvent = Event;
export type RsvpInput = { data: { eventId: string } };
export type HostMapLocationInput = {
  marketCode: string;
  cityCode: string;
  locale: 'ar' | 'fr' | 'en';
};
export type VenueSearchInput = HostMapLocationInput & { query: string };
export type VenueReverseInput = HostMapLocationInput & {
  latitude: number;
  longitude: number;
};
