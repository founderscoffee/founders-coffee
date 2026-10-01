import { AppError, err, ok, type Result } from '@founders-coffee/core';
import type { ChatAccess } from '@founders-coffee/db';

export type AdmittedChat = {
  readonly marketCode: string;
  readonly hostId: string;
  readonly readOnlyAt: Date;
};

/** The error for a meetup with no chat to open: no such meetup, or a chat whose 90 days are over. */
export const chatNotFound = (): AppError =>
  new AppError('chat_not_found', 'This meetup has no chat');

/** The error for someone the chat's membership rule does not admit. */
export const notChatMember = (): AppError =>
  new AppError(
    'chat_not_member',
    'Only the host and the people going can use this chat',
  );

/**
 * Admit the reader `access` was read for, or say why not.
 *
 * `access` is the row the chat's own reads return beside their messages, so the answer and the
 * page come from one snapshot. A meetup with no chat is answered first, since there is nothing to
 * be a member of; everyone the membership rule refuses, a switched-off market included, is then
 * answered alike, so the refusal says nothing about which rule it was.
 */
export const admitReader = (
  access: ChatAccess | undefined,
): Result<AdmittedChat> => {
  if (!access?.channelId || !access.readOnlyAt) return err(chatNotFound());
  if (!access.isMember) return err(notChatMember());
  return ok({
    marketCode: access.marketCode,
    hostId: access.hostId,
    readOnlyAt: access.readOnlyAt,
  });
};
