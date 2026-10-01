import { chat } from '@founders-coffee/domain';
import { getZonedWallClock } from '@founders-coffee/i18n';

import type { ChatMessageView } from './api';

export type PendingMessage = {
  readonly clientId: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly status: 'sending' | 'failed';
};

export type ChatDay = 'today' | 'yesterday' | 'earlier';

export type ChatListItem =
  | {
      readonly kind: 'day';
      readonly key: string;
      readonly date: Date;
      readonly day: ChatDay;
    }
  | { readonly kind: 'unread'; readonly key: 'unread' }
  | {
      readonly kind: 'message';
      readonly key: string;
      readonly message: ChatMessageView;
      readonly segments: readonly chat.ChatBodySegment[];
      readonly notice: chat.ChatSystemNotice | null;
      readonly isFirstOfRun: boolean;
    }
  | {
      readonly kind: 'pending';
      readonly key: string;
      readonly pending: PendingMessage;
      readonly segments: readonly chat.ChatBodySegment[];
    };

const RUN_GAP_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

/** The calendar day an instant falls on in the market's time zone, as a count of days. */
const dayNumber = (at: Date, timeZone: string): number => {
  const { year, month, day } = getZonedWallClock(at.getTime(), timeZone);
  return Date.UTC(year, month - 1, day) / DAY_MS;
};

const dayOf = (at: Date, now: Date, timeZone: string): ChatDay => {
  const behind = dayNumber(now, timeZone) - dayNumber(at, timeZone);
  if (behind <= 0) return 'today';
  return behind === 1 ? 'yesterday' : 'earlier';
};

/**
 * Whether `message` starts a new run of one author's messages, which shows their face and name.
 *
 * A run is one member's messages in a row on one day, each within five minutes of the last. A
 * system message or a removed one ends a run, since neither is part of what the author said.
 */
const startsRun = (
  message: ChatMessageView,
  previous: ChatMessageView | null,
  timeZone: string,
): boolean =>
  !previous ||
  previous.kind === 'system' ||
  previous.removal !== null ||
  previous.author?.id !== message.author?.id ||
  message.createdAt.getTime() - previous.createdAt.getTime() > RUN_GAP_MS ||
  dayNumber(message.createdAt, timeZone) !==
    dayNumber(previous.createdAt, timeZone);

/**
 * Where the unread divider goes: before the first message after the reader's read marker that
 * someone else wrote and that is still there to read. A notice about the meetup is never unread,
 * here as in the counts and the push: its news reaches the members by its own push and email.
 *
 * A reader who has never opened the chat has no marker, and a divider above everything would say
 * nothing, so there is none.
 */
const firstUnreadId = (
  messages: readonly ChatMessageView[],
  lastReadAt: Date | null,
): string | null => {
  if (!lastReadAt) return null;
  const first = messages.find(
    (message) =>
      message.kind === 'text' &&
      !message.isOwn &&
      message.removal === null &&
      message.createdAt.getTime() > lastReadAt.getTime(),
  );
  return first?.id ?? null;
};

/**
 * The rows of a chat's log, oldest first: each message and each message still sending, with a line
 * at the start of every day in the market's time zone and the unread divider before the first
 * message the reader has not read.
 *
 * A message's body is cut into its text and the web addresses in it, by the same rule for every
 * screen, so a link opens what the address parses as. A system message is read into the notice its
 * key and parameters make, or into none when this screen does not know them, which it shows as a
 * change to the meetup rather than as nothing.
 */
export const chatListItems = (input: {
  readonly messages: readonly ChatMessageView[];
  readonly pending: readonly PendingMessage[];
  readonly lastReadAt: Date | null;
  readonly now: Date;
  readonly timeZone: string;
}): ChatListItem[] => {
  const { messages, pending, lastReadAt, now, timeZone } = input;
  const unreadId = firstUnreadId(messages, lastReadAt);
  const items: ChatListItem[] = [];
  let lastDay: number | null = null;
  const markDay = (at: Date): void => {
    const day = dayNumber(at, timeZone);
    if (day === lastDay) return;
    lastDay = day;
    items.push({
      kind: 'day',
      key: `day:${day}`,
      date: at,
      day: dayOf(at, now, timeZone),
    });
  };

  let previous: ChatMessageView | null = null;
  for (const message of messages) {
    markDay(message.createdAt);
    if (message.id === unreadId) items.push({ kind: 'unread', key: 'unread' });
    items.push({
      kind: 'message',
      key: message.id,
      message,
      segments: chat.chatBodySegments(message.body),
      notice:
        message.kind === 'system'
          ? chat.readChatSystemNotice(message.systemKey, message.systemParams)
          : null,
      isFirstOfRun: startsRun(message, previous, timeZone),
    });
    previous = message;
  }
  for (const entry of pending) {
    markDay(entry.createdAt);
    items.push({
      kind: 'pending',
      key: `pending:${entry.clientId}`,
      pending: entry,
      segments: chat.chatBodySegments(entry.body),
    });
  }
  return items;
};

/** A message body as the chat keeps it, or `null` when nothing of it would be sent. */
export const sendableBody = (draft: string): string | null => {
  const body = chat.normalizeChatBody(draft);
  return body.length > 0 && body.length <= chat.CHAT_MESSAGE_MAX_LENGTH
    ? body
    : null;
};

export const CHAT_MESSAGE_MAX_LENGTH = chat.CHAT_MESSAGE_MAX_LENGTH;
