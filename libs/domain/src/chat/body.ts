import { z } from 'zod';

export const CHAT_MESSAGE_MAX_LENGTH = 1000;

const LINE_BREAKS = /[\t\n\v\f\r\u0085\u2028\u2029]+/gu;
const INVISIBLE = /[\p{Cc}\u200b\u202a-\u202e\u2066-\u2069\ufeff]/gu;

/**
 * A message body as the chat keeps it: one line, holding nothing a reader cannot see.
 *
 * Line breaks and tabs become spaces, since a message is one line. Control characters, zero-width
 * spaces and byte-order marks are dropped, so a body cannot look empty and still be sent. So are the
 * explicit direction controls, the embeddings, overrides and isolates: inside a message's own
 * `<bdi>` they still reorder its text, so an address could read as one site and link to another.
 * The marks a writer types to settle a direction (LRM, RLM, ALM) and the joiners that shape Arabic
 * and emoji stay.
 */
export const normalizeChatBody = (value: string): string =>
  value.replace(LINE_BREAKS, ' ').replace(INVISIBLE, '').trim();

export const chatMessageBodySchema = z
  .string()
  .max(CHAT_MESSAGE_MAX_LENGTH * 4)
  .transform(normalizeChatBody)
  .pipe(z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH));
