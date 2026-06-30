import type { Event } from '@founders-coffee/db';

/**
 * Attendance fields attached to an event response. Populated by P1-008 (RSVP + atomic capacity).
 * See [`docs/p1-007-008-contract.md`](../../../../docs/p1-007-008-contract.md) §1.
 */
export interface EventAttendance {
  /** Count of RSVPs with status = 'going'. */
  readonly goingCount: number;
  /** Remaining seats. `null` ⇔ capacity === 0 (unlimited / free-form). */
  readonly remaining: number | null;
  /** The viewer's RSVP. `null` ⇔ logged-out or not RSVP'd. */
  readonly viewerRsvp: 'going' | null;
}

/**
 * During the P1-007 ∥ P1-008 parallel period the attendance fields are OPTIONAL (absent until
 * P1-008). P1-008 narrows this to `Event & EventAttendance` (required) and populates the fields at
 * the RPC layer. UI MUST render them defensively — guard with `event.goingCount != null` and never
 * assume a field is present, never stub a fake `0`.
 */
export type EventWithAttendance = Event & Partial<EventAttendance>;
