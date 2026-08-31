import {
  cancelRsvp,
  createEvent,
  createRsvp,
  getEvent,
  getUpcomingEvents,
  type EventCreateInput,
  type EventFeedItem,
  type EventFeedPage,
  type EventWithAttendance,
} from '@founders-coffee/server-fns';

export const eventsApi = {
  getUpcomingEvents,
  createEvent,
  getEvent,
  createRsvp,
  cancelRsvp,
};

export type {
  EventCreateInput,
  EventFeedItem,
  EventFeedPage,
  EventWithAttendance,
};
export type CreateEventInput = { data: EventCreateInput };
export type RsvpInput = { data: { eventId: string } };
