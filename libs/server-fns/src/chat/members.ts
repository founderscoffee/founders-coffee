import { err, ok, type Result } from '@founders-coffee/core';
import { markChatRead, setChatMuted, type Db } from '@founders-coffee/db';

import { notChatMember } from './access.js';

/**
 * Move a member's read marker in the chat of `eventId` forward to `at`, in milliseconds.
 *
 * A reader the write does not take, because they are not a member or the meetup has no chat, is
 * refused alike.
 */
export const markChatReadResolver = async (
  db: Db,
  input: { eventId: string; userId: string; at: number },
): Promise<Result<null>> =>
  (await markChatRead(db, input)) ? ok(null) : err(notChatMember());

/** Mute or unmute the chat of `eventId` for one of its members, answering with the state it is in. */
export const setChatMutedResolver = async (
  db: Db,
  input: { eventId: string; userId: string; muted: boolean },
): Promise<Result<{ readonly muted: boolean }>> =>
  (await setChatMuted(db, input))
    ? ok({ muted: input.muted })
    : err(notChatMember());
