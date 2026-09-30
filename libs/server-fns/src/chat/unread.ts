import { ok, type Result } from '@founders-coffee/core';
import {
  CHAT_UNREAD_TITLE_SLOT,
  countUnreadChatMessages,
  type ChatUnreadCount,
  type ChatUnreadNotice,
  type Db,
} from '@founders-coffee/db';
import {
  ntf_push_chat_unread_body,
  ntf_push_chat_unread_title,
  type Locale,
} from '@founders-coffee/i18n';

import { notificationBaseUrl } from '../notifications/context.js';

export const CHAT_UNREAD_DELAY_MS = 2 * 60 * 1000;

const wordingIn = (locale: Locale) => ({
  title: ntf_push_chat_unread_title(
    { title: CHAT_UNREAD_TITLE_SLOT },
    { locale },
  ),
  body: ntf_push_chat_unread_body({}, { locale }),
});

/**
 * The `chat_unread` push a message sent at `now` queues for the other members: due two minutes
 * later, so a member reading along in those two minutes is never told, and worded in each
 * language with the meetup's title left to the database. It says only that there are new
 * messages in the meetup, never whose or what, since a phone shows it on its lock screen.
 */
export const chatUnreadNotice = (now: Date): ChatUnreadNotice => ({
  sendAt: new Date(now.getTime() + CHAT_UNREAD_DELAY_MS),
  baseUrl: notificationBaseUrl(),
  content: { ar: wordingIn('ar'), en: wordingIn('en'), fr: wordingIn('fr') },
});

/** How many messages the member has not read in each of their chats among `eventIds`. */
export const readChatUnreadCountsResolver = async (
  db: Db,
  input: { userId: string; eventIds: readonly string[] },
): Promise<Result<readonly ChatUnreadCount[]>> =>
  ok(await countUnreadChatMessages(db, input));
