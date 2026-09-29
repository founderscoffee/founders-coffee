import type {
  ChatMessageKind,
  ChatMessageRemoval,
} from '@founders-coffee/core';
import type { ChatMessageWithAuthor } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

export interface ChatAuthor {
  readonly id: string;
  readonly name: string | null;
  readonly photoAssetId: string | null;
}

export interface ChatMessageView {
  readonly id: string;
  readonly kind: ChatMessageKind;
  readonly body: string;
  readonly systemKey: string | null;
  readonly systemParams: Readonly<Record<string, string>> | null;
  readonly createdAt: Date;
  readonly removal: ChatMessageRemoval | null;
  readonly author: ChatAuthor | null;
  readonly isOwn: boolean;
  readonly clientId: string | null;
}

/**
 * A stored message as `viewerId`'s screen shows it.
 *
 * A system message has no author. A member's message names its author by the name their public
 * profile shows, checked against their email the way the profile checks it, and by no name when
 * their identity is no longer visible or the name is unsafe to show, which the screen reads as
 * "Member". The email itself goes no further. The device's `clientId` goes back only to the author,
 * whose screen matches it to the message it was still sending; nobody else has a use for it.
 */
export const chatMessageView = (
  row: ChatMessageWithAuthor,
  viewerId: string,
): ChatMessageView => {
  const isOwn = row.authorId !== null && row.authorId === viewerId;
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    systemKey: row.systemKey,
    systemParams: row.systemParams ?? null,
    createdAt: row.createdAt,
    removal: row.removal,
    author:
      row.authorId === null
        ? null
        : {
            id: row.authorId,
            name: row.authorName
              ? profile.safeProfileDisplayName(
                  row.authorName,
                  row.authorEmail,
                ) || null
              : null,
            photoAssetId: row.authorPhotoAssetId,
          },
    isOwn,
    clientId: isOwn ? row.clientId : null,
  };
};
