import {
  AppError,
  err,
  ok,
  type EventStatus,
  type Result,
} from '@founders-coffee/core';

export type { EventStatus } from '@founders-coffee/core';

const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  published: ['cancelled'],
  cancelled: ['published'],
};

export const canTransition = (from: EventStatus, to: EventStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const transition = (
  from: EventStatus,
  to: EventStatus,
): Result<EventStatus> =>
  canTransition(from, to)
    ? ok(to)
    : err(
        new AppError(
          'invalid_event_transition',
          `Cannot transition event from '${from}' to '${to}'`,
        ),
      );
