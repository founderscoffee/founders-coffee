import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  communityOperationsEnabled,
  getCloseout,
  getEvent,
  type Db,
} from '@founders-coffee/db';

export interface RepeatEventTemplate {
  readonly sourceEventId: string;
  readonly marketCode: string;
  readonly cityCode: string;
  readonly title: string;
  readonly description: string;
  readonly venue: string;
  readonly venueAddress: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

const ineligible = (): Result<RepeatEventTemplate> =>
  err(
    new AppError(
      'repeat_event_not_eligible',
      'Only a completed gathering can be repeated',
    ),
  );

export const readRepeatEventTemplate = async (
  db: Db,
  opts: { eventId: string; actorId: string },
): Promise<Result<RepeatEventTemplate>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (event.hostId !== opts.actorId) {
    return err(
      new AppError(
        'repeat_event_not_host',
        'Only the host can repeat this gathering',
      ),
    );
  }
  if (!(await communityOperationsEnabled(db, event.marketCode))) {
    return err(
      new AppError(
        'operations_disabled',
        'Community operations are not enabled in this market',
      ),
    );
  }
  if (
    event.status === 'cancelled' ||
    event.endsAt === null ||
    event.endsAt.getTime() > Date.now()
  ) {
    return ineligible();
  }
  const closeout = await getCloseout(db, event.id);
  if (closeout?.outcome !== 'held') return ineligible();

  return ok({
    sourceEventId: event.id,
    marketCode: event.marketCode,
    cityCode: event.cityCode,
    title: event.title,
    description: event.description,
    venue: event.venue,
    venueAddress: event.venueAddress,
    latitude: event.latitude,
    longitude: event.longitude,
  });
};
