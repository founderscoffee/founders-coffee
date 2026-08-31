export {
  attachAttendance,
  type EventAttendance,
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
export { createEvent, getEvent, getUpcomingEvents } from './rpc.js';
