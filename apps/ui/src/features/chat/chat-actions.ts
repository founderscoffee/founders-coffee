import type { ChatMessageView } from './api';

export type ChatMessageAction = 'delete' | 'remove' | 'report';

/**
 * What the reader may do with a message: delete their own, and report anyone else's, which the
 * meetup's host may also remove from the chat. A notice about the meetup and a message already
 * removed offer nothing, and neither does one still sending, which is not a message yet.
 *
 * The server holds the same rules; these only decide what the panel offers.
 */
export const chatMessageActions = (
  message: ChatMessageView,
  isHost: boolean,
): readonly ChatMessageAction[] => {
  if (message.kind !== 'text' || message.removal !== null) return [];
  if (message.isOwn) return ['delete'];
  return isHost ? ['remove', 'report'] : ['report'];
};
