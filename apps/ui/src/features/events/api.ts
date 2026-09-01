import {
  cancelRsvp,
  createEvent,
  createRsvp,
  getCity,
  getEvent,
  getHostMapContext,
  getMapboxToken,
  getMarket,
  getUpcomingEvents,
  reverseEventVenue,
  searchEventVenues,
  type EventCreateInput,
  type EventFeedItem,
  type EventFeedPage,
  type EventWithAttendance,
  type HostMapContext,
  type VenueCandidate,
} from '@founders-coffee/server-fns';

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
};

export type {
  EventCreateInput,
  EventFeedItem,
  EventFeedPage,
  EventWithAttendance,
  HostMapContext,
  VenueCandidate,
};
export type CreateEventInput = { data: EventCreateInput };
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
