import { z } from 'zod';

import type { ChatSystemKey } from '@founders-coffee/core';

const named = z.string().min(1);

/** A notice's key, held to the keys the chat stores. */
const keyOf = <Key extends ChatSystemKey>(key: Key) => z.literal(key);

export const chatSystemNoticeSchema = z.discriminatedUnion('key', [
  z.object({
    key: keyOf('rescheduled'),
    params: z.object({ startsAt: z.iso.datetime(), venue: named }),
  }),
  z.object({
    key: keyOf('relocated'),
    params: z.object({ venue: named, address: named.optional() }),
  }),
  z.object({
    key: keyOf('cancelled'),
    params: z.object({ reason: named.optional() }),
  }),
]);

export type ChatSystemNotice = z.infer<typeof chatSystemNoticeSchema>;

/**
 * What a system message says happened to its meetup, read from the key and parameters it was
 * stored with, or `null` when this build cannot read them: a key a later build added, or
 * parameters that do not fit their key. A parameter a later build added to a known key is left
 * out rather than refused, so an older screen still reads the rest.
 */
export const readChatSystemNotice = (
  systemKey: string | null,
  systemParams: Readonly<Record<string, string>> | null,
): ChatSystemNotice | null => {
  const read = chatSystemNoticeSchema.safeParse({
    key: systemKey,
    params: systemParams ?? {},
  });
  return read.success ? read.data : null;
};
