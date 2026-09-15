import {
  AppError,
  err,
  ok,
  type FeedbackEligibilityStatus,
  type Result,
} from '@founders-coffee/core';
import {
  communityOperationsEnabled,
  findNextEvent,
  getEvent,
  getFeedback,
  getFeedbackEligibility,
  getMarketByCode,
  saveFeedback,
  type Db,
  type EventFeedbackRow,
} from '@founders-coffee/db';
import { geo, type operations } from '@founders-coffee/domain';

export interface FeedbackView {
  readonly eventId: string;
  readonly title: string;
  readonly venue: string;
  readonly slug: string;
  readonly marketCode: string;
  readonly marketSlug: string;
  readonly cityCode: string;
  readonly citySlug: string | null;
  readonly status: Extract<
    FeedbackEligibilityStatus,
    'ready' | 'window_closed'
  >;
  readonly feedback: EventFeedbackRow | null;
  readonly nextEvent: { readonly slug: string; readonly title: string } | null;
}

const feedbackError = (status: FeedbackEligibilityStatus): AppError => {
  if (status === 'not_attended')
    return new AppError(
      'feedback_not_attended',
      'Feedback is available to attendees only',
    );
  if (status === 'window_closed')
    return new AppError(
      'feedback_window_closed',
      'The feedback window has closed',
    );
  return new AppError(
    'feedback_not_invited',
    'Feedback is not available for this event',
  );
};

export const readFeedback = async (
  db: Db,
  opts: { eventId: string; userId: string },
): Promise<Result<FeedbackView>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (!(await communityOperationsEnabled(db, event.marketCode)))
    return err(
      new AppError(
        'operations_disabled',
        'Community operations are not enabled in this market',
      ),
    );
  const status = await getFeedbackEligibility(db, opts);
  const feedback = await getFeedback(db, opts);
  if (status !== 'ready' && !feedback) return err(feedbackError(status));
  const viewStatus = status === 'ready' ? 'ready' : 'window_closed';
  const next =
    viewStatus === 'ready'
      ? await findNextEvent(db, {
          marketCode: event.marketCode,
          cityCode: event.cityCode,
        })
      : undefined;
  return ok({
    eventId: event.id,
    title: event.title,
    venue: event.venue,
    slug: event.slug,
    marketCode: event.marketCode,
    marketSlug:
      (await getMarketByCode(db, event.marketCode))?.slug ?? event.marketCode,
    cityCode: event.cityCode,
    citySlug: geo.findCity(event.marketCode, event.cityCode)?.slug ?? null,
    status: viewStatus,
    feedback: feedback ?? null,
    nextEvent: next ? { slug: next.slug, title: next.title } : null,
  });
};

export const submitFeedbackResolver = async (
  db: Db,
  opts: { userId: string; input: operations.SubmitFeedbackInput },
): Promise<Result<EventFeedbackRow>> => {
  const event = await getEvent(db, opts.input.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (!(await communityOperationsEnabled(db, event.marketCode)))
    return err(
      new AppError(
        'operations_disabled',
        'Community operations are not enabled in this market',
      ),
    );
  const result = await saveFeedback(db, {
    ...opts.input,
    userId: opts.userId,
    rowId: `fbk_${opts.input.eventId}_${opts.userId}`,
  });
  if (result.outcome !== 'saved' || !result.row)
    return err(
      feedbackError(
        result.outcome === 'saved' ? 'not_invited' : result.outcome,
      ),
    );
  return ok(result.row);
};
