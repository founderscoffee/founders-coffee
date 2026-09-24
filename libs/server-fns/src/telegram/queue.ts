import { id, type TelegramTemplateKey } from '@founders-coffee/core';
import { enqueueNotification, type Db, type Event } from '@founders-coffee/db';

import { validPayload } from '../notifications/producer.js';
import type { TelegramValues } from './texts.js';

export interface TelegramContent {
  readonly telegramText?: string;
  readonly telegramPinnedText?: string;
  readonly telegramChatId?: number;
  readonly telegramUserId?: number;
  readonly telegramInviteLink?: string;
  readonly telegramInviteLinks?: readonly string[];
}

/**
 * Queue one thing for the bot to do in a meetup's group.
 *
 * Group posts go through the same table, alarm and sweep as personal notices, so they are retried,
 * claimed and accounted for the same way. The row is attributed to the host, whose group it is,
 * except a removal, which belongs to the member leaving. The text is written now, like every
 * notice's, which is why a change to the meetup rewrites the rows still waiting.
 */
export const enqueueTelegram = async (
  db: Db,
  opts: {
    event: Event;
    values: TelegramValues;
    templateKey: TelegramTemplateKey;
    sendAt: Date;
    content: TelegramContent;
    userId?: string;
  },
): Promise<void> => {
  await enqueueNotification(db, {
    id: id('ntf'),
    eventId: opts.event.id,
    userId: opts.userId ?? opts.event.hostId,
    channel: 'telegram',
    templateKey: opts.templateKey,
    payload: validPayload('telegram', { ...opts.values.base, ...opts.content }),
    sendAt: opts.sendAt,
  });
};
