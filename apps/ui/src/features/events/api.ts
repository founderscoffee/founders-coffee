import {
  cancelEvent,
  cancelRsvp,
  createEvent,
  createRsvp,
  getCity,
  getEvent,
  getHostedEvents,
  getHostMapContext,
  getMyJoinedEvents,
  getMapboxToken,
  getMarket,
  getPublicAuthConfig,
  getRepeatEventTemplate,
  getUpcomingEvents,
  listNearbyVenues,
  reverseEventVenue,
  searchEventVenues,
  type EventCancelRequestInput,
  type EventCreateRequestInput,
  type EventFeedItem,
  type EventFeedPage,
  type HostedEventPage,
  type RepeatEventTemplate,
  type EventWithAttendance,
  type HostMapContext,
  type VenueCandidate,
} from '@founders-coffee/server-fns';
import type { Event } from '@founders-coffee/db';
import type { Locale } from '@founders-coffee/core';

export const eventsApi = {
  getUpcomingEvents,
  createEvent,
  getEvent,
  getHostedEvents,
  getMyJoinedEvents,
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
  getRepeatEventTemplate,
};

export type {
  EventCancelRequestInput,
  EventCreateRequestInput,
  EventFeedItem,
  EventFeedPage,
  HostedEventPage,
  RepeatEventTemplate,
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
  locale: Locale;
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
