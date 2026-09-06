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
export type {
  EventCancelRequestInput,
  EventCreateRequestInput,
} from './schemas.js';
export {
  cancelEvent,
  createEvent,
  getEvent,
  getUpcomingEvents,
} from './rpc.js';
