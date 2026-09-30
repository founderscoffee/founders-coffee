import { z } from 'zod';

import {
  CHAT_ROOM_CLOSES,
  type ChatMessageRemoval,
} from '@founders-coffee/core';
import type { ChatMessageWithAuthor } from '@founders-coffee/db';

import type { RoomRefusals } from '../rooms/refusals.js';
import type { ChatMessageView } from './view.js';

export const chatRoomMember = z.object({
  userId: z.string(),
  sessionToken: z.string(),
});

export type ChatRoomMember = z.infer<typeof chatRoomMember>;

export type ChatRoomFrame =
  | { readonly type: 'message'; readonly message: ChatMessageView }
  | {
      readonly type: 'removed';
      readonly id: string;
      readonly removal: ChatMessageRemoval;
    }
  | { readonly type: 'closed' }
  | { readonly type: 'revoked' };

export type ChatRoomUpdate =
  | { readonly type: 'message'; readonly message: ChatMessageWithAuthor }
  | {
      readonly type: 'removed';
      readonly id: string;
      readonly removal: ChatMessageRemoval;
    };

export const CHAT_ROOM_REFUSALS: RoomRefusals<ChatRoomFrame> = {
  notAllowed: { frame: { type: 'revoked' }, close: CHAT_ROOM_CLOSES.revoked },
  noSession: { frame: null, close: CHAT_ROOM_CLOSES.noSession },
  unavailable: null,
};
