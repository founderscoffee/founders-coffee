export type ChatState = 'open' | 'read_only';

/**
 * Whether a chat still takes messages at `now`.
 *
 * `readOnlyAt` is the whole rule, stored with the channel: seven days after the meetup ends, or the
 * moment it is cancelled. The instant itself is read-only, the same boundary the database's send
 * guard draws with `read_only_at > now`.
 */
export const chatState = (
  channel: { readonly readOnlyAt: Date },
  now: Date,
): ChatState =>
  now.getTime() < channel.readOnlyAt.getTime() ? 'open' : 'read_only';
