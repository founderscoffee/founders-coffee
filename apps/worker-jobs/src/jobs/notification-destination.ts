import type { NotificationDeliveryChannel } from '@founders-coffee/core';
import {
  communityOperationsEnabled,
  getNotificationContact,
  isDeliverableAccountState,
  listDeliverablePushTokens,
  type Db,
  type ScheduledNotification,
} from '@founders-coffee/db';
import { notifications } from '@founders-coffee/domain';

export type Destination =
  | {
      readonly channel: Extract<NotificationDeliveryChannel, 'sms'>;
      readonly phoneNumber: string;
    }
  | {
      readonly channel: Extract<NotificationDeliveryChannel, 'email'>;
      readonly email: string;
    }
  | {
      readonly channel: Extract<NotificationDeliveryChannel, 'push'>;
      readonly tokens: readonly string[];
    };

export type DestinationResult =
  | { readonly ok: true; readonly destination: Destination }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly account: boolean;
      readonly transient?: boolean;
    };

/**
 * A refusal that will stop being true on its own.
 *
 * Every other refusal here is a statement about the recipient — no address, no device, a category
 * switched off — and none of those resolve by waiting, so the row is failed permanently and the
 * budget is not spent retrying. A market flag is different in kind: it is a statement about the
 * deployment, it is expected to change, and §5 asks that an intent stay recoverable while it is off.
 * Retiring the row would make "recoverable" mean "recoverable until it comes due".
 */
const held = (reason: string): DestinationResult => ({
  ok: false,
  reason,
  account: true,
  transient: true,
});

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
 * confirmations leaves people wondering whether the RSVP worked.
 *
 * `closeout_prompt` passes them for the same reason, and deliberately does not hang off either
 * host RSVP switch. Asking a host what happened at their own gathering is not an RSVP confirmation
 * or cancellation notice — honouring either control here would mean a control that does something
 * other than what it says. If hosts want to silence the prompt it earns its own switch; until then
 * the market flag below is its only gate.
 * The categories exist to control what arrives unprompted: reminders under `event_reminders`, event
 * cancellation notices under `event_updates`, RSVP confirmations and cancellations under their
 * respective host preferences, and feedback invitations under `follow_up_prompts`.
 *
 * The market flag is enforced here rather than in the producer, and rather than in the sweep loop.
 * §5 gates prompt delivery, and this is the one place every channel already passes through before a
 * send — a market that switches operations off between the intent being written and the prompt
 * coming due refuses here, and one that switches them on later delivers without needing the intent
 * to have been rewritten. The sweep already wraps this call against exceptions, which a gate bolted
 * into its claimed-row loop would not have been.
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
  marketCode?: string,
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
  if (
    (templateKey === 'event_cancelled' ||
      templateKey === 'event_did_not_happen') &&
    !contact.eventUpdates
  )
    return unreachable('event_updates_off', true);
  if (templateKey === 'rsvp_received' && !contact.hostRsvpReceived)
    return unreachable('host_rsvp_received_off', true);
  if (templateKey === 'rsvp_cancelled' && !contact.hostRsvpCancelled)
    return unreachable('host_rsvp_cancelled_off', true);

  if (templateKey === 'feedback_invitation' && !contact.followUpPrompts)
    return unreachable('follow_up_prompts_off', true);

  const categoryMask = notifications.notificationMaskForTemplate(
    templateKey,
    contact,
  );
  if (categoryMask === 0) return unreachable('notification_channels_off', true);
  if (
    (channel === 'push' || channel === 'email') &&
    !notifications.isNotificationChannelEnabled(categoryMask, channel)
  )
    return unreachable(`${channel}_disabled`, false);

  if (
    (templateKey === 'closeout_prompt' ||
      templateKey === 'feedback_invitation') &&
    !(await communityOperationsEnabled(db, marketCode ?? ''))
  )
    return held('operations_disabled');

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
