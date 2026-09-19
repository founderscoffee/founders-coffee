import { createServerFn } from '@tanstack/react-start';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requireAuth } from '../authz.js';
import { authMiddleware, requirePermission } from '../auth-middleware.js';
import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import { readCloseoutStates } from './closeout-state.js';
import { readCloseout, submitCloseoutResolver } from './closeout.js';
import { readFeedback, submitFeedbackResolver } from './feedback.js';
import {
  closeoutStatesRequestSchema,
  closeoutViewRequestSchema,
  submitCloseoutRequestSchema,
  feedbackViewRequestSchema,
  submitFeedbackRequestSchema,
} from './schemas.js';

/**
 * What the host needs to close a gathering out.
 *
 * Owner-only by construction: the resolver compares the event's host to the session and refuses
 * anyone else, so no event id in the request can widen it. `privateNoStore` because the roster names
 * members who attended a private gathering and must not sit in a shared cache.
 */
export const getCloseoutView = createServerFn({ method: 'GET', strict: false })
  .middleware([authMiddleware])
  .validator(appValidator(closeoutViewRequestSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    privateNoStore();
    return handleResult(
      readCloseout(getDb(), {
        eventId: data.eventId,
        actorId: session.user.id,
      }),
    );
  });

/**
 * Which of the caller's own past gatherings still want closing out.
 *
 * Answers about the session's own events only — the ids are a filter, never an authorisation — so
 * this cannot be pointed at another host to learn which of their gatherings did not happen.
 * `privateNoStore` for the same reason: the answer is one person's and belongs in no shared cache.
 */
export const getMyCloseoutStates = createServerFn({
  method: 'GET',
  strict: false,
})
  .middleware([authMiddleware])
  .validator(appValidator(closeoutStatesRequestSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    privateNoStore();
    return handleResult(
      readCloseoutStates(getDb(), {
        hostId: session.user.id,
        eventIds: data.eventIds,
      }),
    );
  });

/**
 * Close a gathering out and record who came.
 *
 * The closeout and the marks arrive together because they are one decision: a host says the
 * gathering happened and says who came in the same breath, and a request that could carry half of
 * that would leave a closed-out gathering with nobody recorded. The list is bounded in the schema
 * for the same reason the domain batch is — an unbounded roster is an unbounded write loop.
 *
 * Rate limited per identity because it writes an audit entry per mark: a roster of two hundred is
 * two hundred audited writes, and a host retrying a failed submission should not be able to multiply
 * that without bound. The host check lives in the resolver and in the database guard beneath it —
 * `submitCloseout` re-evaluates it inside the write, so a session that changed hands between the
 * check and the statement cannot slip through.
 */
export const submitCloseout = createServerFn({ method: 'POST', strict: false })
  .middleware([authMiddleware, rateLimit('submit_closeout', 10, 600_000)])
  .validator(appValidator(submitCloseoutRequestSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    return handleResult(
      submitCloseoutResolver(getDb(), {
        actorId: session.user.id,
        input: data.closeout,
        attendance: data.attendance,
      }),
    );
  });

export const getFeedbackView = createServerFn({ strict: false })
  .middleware([requirePermission('rsvp', 'read')])
  .validator(appValidator(feedbackViewRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      readFeedback(getDb(), {
        eventId: data.eventId,
        userId: requireAuth(context.session).user.id,
      }),
    );
  });

export const submitFeedback = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('rsvp', 'update'),
    rateLimit('submit_feedback', 5, 600_000),
  ])
  .validator(appValidator(submitFeedbackRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      submitFeedbackResolver(getDb(), {
        userId: requireAuth(context.session).user.id,
        input: data.feedback,
      }),
    );
  });
