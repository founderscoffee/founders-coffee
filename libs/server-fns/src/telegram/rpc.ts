import { createServerFn } from '@tanstack/react-start';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requireAuth } from '../authz.js';
import { requirePermission } from '../auth-middleware.js';
import { getDb } from '../db.js';
import { RATE_BUDGETS, type RateBudget } from '../rate-budgets.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import { telegramSetup } from './config.js';
import {
  connectTelegramGroupResolver,
  disconnectTelegramGroupResolver,
} from './host.js';
import { requestTelegramInviteResolver } from './invite.js';
import { telegramGroupRequestSchema } from './schemas.js';
import { readTelegramGroupView } from './view.js';

const limitedTo = (budget: RateBudget) =>
  rateLimit(budget.action, budget.limit, budget.windowMs);

/**
 * The meetup's Telegram group as the signed-in reader sees it: as its host, as a member going, or
 * not at all.
 */
export const getTelegramGroupView = createServerFn({ strict: false })
  .middleware([requirePermission('event', 'read')])
  .validator(appValidator(telegramGroupRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      readTelegramGroupView(getDb(), telegramSetup(), {
        eventId: data.eventId,
        viewerId: requireAuth(context.session).user.id,
        now: new Date(),
      }),
    );
  });

/**
 * A link that connects a Telegram group to a meetup the caller hosts. Ownership is checked against
 * the row, and the link carries a one-time token, so the response is never cached.
 */
export const connectTelegramGroup = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('event', 'create'),
    limitedTo(RATE_BUDGETS.edit.telegramConnect),
  ])
  .validator(appValidator(telegramGroupRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      connectTelegramGroupResolver(getDb(), telegramSetup(), {
        eventId: data.eventId,
        actorId: requireAuth(context.session).user.id,
        now: new Date(),
      }),
    );
  });

/** Let the bot go from a meetup the caller hosts, or withdraw the Connect link they have not used. */
export const disconnectTelegramGroup = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('event', 'create'),
    limitedTo(RATE_BUDGETS.edit.telegramDisconnect),
  ])
  .validator(appValidator(telegramGroupRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      disconnectTelegramGroupResolver(getDb(), {
        eventId: data.eventId,
        actorId: requireAuth(context.session).user.id,
        now: new Date(),
      }),
    );
  });

/** The caller's own link into the Telegram group of a meetup they are going to. */
export const requestTelegramInvite = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('rsvp', 'create'),
    limitedTo(RATE_BUDGETS.expensive.telegramInvite),
  ])
  .validator(appValidator(telegramGroupRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      requestTelegramInviteResolver(getDb(), telegramSetup(), {
        eventId: data.eventId,
        userId: requireAuth(context.session).user.id,
        now: new Date(),
      }),
    );
  });
