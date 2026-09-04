export {
  attachAttendance,
  type EventAttendance,
  type EventDetailItem,
  type EventWithAttendance,
} from './attendance.js';
export {
  createEventResolver,
  listEvents,
  resolveEvent,
  type EventFeedItem,
  type EventFeedItemBase,
  type EventFeedPage,
} from './resolver.js';
export type { EventCreateInput } from '@founders-coffee/domain';
export type { EventCreateRequestInput } from './schemas.js';
export { createEvent, getEvent, getUpcomingEvents } from './rpc.js';
