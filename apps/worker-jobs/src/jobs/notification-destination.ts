import {
  getNotificationContact,
  isDeliverableAccountState,
  listDeliverablePushTokens,
  type Db,
  type ScheduledNotification,
} from '@founders-coffee/db';

export type Destination =
  | { readonly channel: 'sms'; readonly phoneNumber: string }
  | { readonly channel: 'email'; readonly email: string }
  | { readonly channel: 'push'; readonly tokens: readonly string[] };

export type DestinationResult =
  | { readonly ok: true; readonly destination: Destination }
  | { readonly ok: false; readonly reason: string; readonly account: boolean };

const unreachable = (reason: string, account = false): DestinationResult => ({
  ok: false,
  reason,
  account,
});

/**
 * Decide where this message may go, reading the answer at send time rather than trusting the row.
 *
 * A queued notification carries the address that was current when it was written. Between then and
 * now a member can have changed their number, removed it, signed a device out or closed the
 * account — and the queue has no way to know, because nothing rewrites payloads that are already
 * scheduled. Sending what the row says is therefore not "delivering the message" but "delivering it
 * to whoever holds that address today", which for a recycled phone number is a stranger reading
 * somebody's plans.
 *
 * The resolved address is returned rather than compared, so a member who changed their number
 * still gets the reminder they are expecting. Only the absence of any address is a refusal.
 *
 * A phone number is only used once the member has verified it, because an unverified number is a
 * string somebody typed and an SMS sent to it reaches whoever actually holds it. Email is not held
 * to the same test: it is the account identity itself, established at sign-up and unique, so there
 * is no unverified alternative address for a message to leak to.
 *
 * The member's own preferences are enforced here rather than at enqueue time, because the row can
 * be days old by the time it is sent and a switch turned off yesterday has to apply to it. A
 * category the member turned off is an account-level refusal — it is true of every channel, so no
 * fallback is written; a channel they have not enabled is not, because the other channel may still
 * be open to them.
 *
 * `rsvp_confirmation` passes every category gate. It is the receipt for something the member did a
 * second ago, not an update the product decided to send them, and a product that swallows its own
 * confirmations leaves people wondering whether the RSVP worked. The categories exist to control
 * what arrives unprompted: reminders under `event_reminders`, cancellation notices under
 * `event_updates`.
 *
 * `account` marks the refusals that are true of every channel. A missing phone says nothing about
 * email, and falling back is exactly right; a closed account says the same thing about all of them,
 * and the caller uses this to stop a fallback being written that could only be refused again.
 */
export const resolveDestination = async (
  db: Db,
  channel: ScheduledNotification['channel'],
  userId: string,
  templateKey?: ScheduledNotification['templateKey'],
): Promise<DestinationResult> => {
  const contact = await getNotificationContact(db, userId);
  if (!contact) return unreachable('recipient_no_longer_exists', true);
  if (!isDeliverableAccountState(contact.accountState))
    return unreachable(`account_${contact.accountState}`, true);

  if (
    (templateKey === 'reminder_72h' || templateKey === 'reminder_24h') &&
    !contact.eventReminders
  )
    return unreachable('event_reminders_off', true);
  if (templateKey === 'event_cancelled' && !contact.eventUpdates)
    return unreachable('event_updates_off', true);

  if (channel === 'sms') {
    if (!contact.phoneNumber) return unreachable('phone_number_removed');
    if (!contact.phoneNumberVerified)
      return unreachable('phone_number_unverified');
    if (!contact.smsFallbackEnabled) return unreachable('sms_not_consented');
    return {
      ok: true,
      destination: { channel, phoneNumber: contact.phoneNumber },
    };
  }

  if (channel === 'email')
    return { ok: true, destination: { channel, email: contact.email } };

  if (!contact.pushEnabled) return unreachable('push_not_enabled');
  const tokens = await listDeliverablePushTokens(db, userId);
  if (tokens.length === 0) return unreachable('no_live_device');
  return { ok: true, destination: { channel, tokens } };
};
