import { geo } from '@founders-coffee/domain';
import {
  ntf_cancel_reason,
  ntf_telegram_cancelled,
  ntf_telegram_cancelled_pinned,
  ntf_telegram_details,
  ntf_telegram_place,
  ntf_telegram_relocated,
  ntf_telegram_reminder,
  ntf_telegram_rescheduled,
  ntf_telegram_wrap_up,
  type Locale,
} from '@founders-coffee/i18n';
import type { Db, Event } from '@founders-coffee/db';

import {
  notificationBaseUrl,
  resolveNotificationContext,
} from '../notifications/context.js';
import {
  valuesFor,
  type NotificationPayload,
} from '../notifications/producer.js';

export interface TelegramValues {
  readonly locale: Locale;
  readonly base: NotificationPayload;
  readonly title: string;
  readonly date: string;
  readonly place: string;
  readonly url: string;
  readonly cityUrl: string;
}

/**
 * Everything a group post says about a meetup, in the meetup's own language.
 *
 * A group is one conversation for everyone in it, so its posts cannot follow each reader's language
 * the way a personal notice does. They use the language the host gave the meetup, which is the one
 * the table will speak, with the market's clock for the time.
 *
 * `place` is the venue and its address together, or the venue alone when the host gave no address or
 * the address only repeats it. `base` is the payload every group row carries, so a row can still be
 * read on its own after the meetup changes.
 */
export const telegramValuesFor = async (
  db: Db,
  event: Event,
): Promise<TelegramValues> => {
  const context = await resolveNotificationContext(db, {
    preferred: event.language,
    marketCode: event.marketCode,
  });
  const locale = context.locale;
  const base: NotificationPayload = {
    eventTitle: event.title,
    eventSlug: event.slug,
    marketCode: event.marketCode,
    startsAt: event.startsAt.toISOString(),
    venue: event.venue,
    venueAddress: event.venueAddress ?? undefined,
    locale,
  };
  const values = valuesFor(base, context, true);
  const address = event.venueAddress?.trim();
  const citySlug = geo.findCity(event.marketCode, event.cityCode)?.slug;
  const marketUrl = `${notificationBaseUrl()}/${locale}/${context.marketSlug}`;
  return {
    locale,
    base,
    title: values.title,
    date: values.date,
    place:
      address && address !== event.venue
        ? ntf_telegram_place({ venue: event.venue, address }, { locale })
        : event.venue,
    url: values.url,
    cityUrl: citySlug ? `${marketUrl}/${citySlug}` : marketUrl,
  };
};

const on = (values: TelegramValues) => ({ locale: values.locale });

/** The pinned message: the meetup's details, and who the group is for. */
export const telegramDetailsText = (values: TelegramValues): string =>
  ntf_telegram_details(values, on(values));

export const telegramReminderText = (values: TelegramValues): string =>
  ntf_telegram_reminder(values, on(values));

export const telegramRescheduledText = (values: TelegramValues): string =>
  ntf_telegram_rescheduled(values, on(values));

export const telegramRelocatedText = (values: TelegramValues): string =>
  ntf_telegram_relocated(values, on(values));

/**
 * The cancellation post, with the host's reason as a sentence of its own when they gave one, the way
 * the personal cancellation notices carry it.
 */
export const telegramCancelledText = (
  values: TelegramValues,
  reason: string | undefined,
): string => {
  const text = ntf_telegram_cancelled(values, on(values));
  return reason
    ? `${text}\n${ntf_cancel_reason({ reason }, on(values))}`
    : text;
};

/** What the pinned message becomes once the meetup is called off, so the pin stops promising it. */
export const telegramCancelledPinnedText = (values: TelegramValues): string =>
  ntf_telegram_cancelled_pinned(values, on(values));

/** The last post: thanks, whose group it is now, and where the next meetups are. */
export const telegramWrapUpText = (values: TelegramValues): string =>
  ntf_telegram_wrap_up({ ...values, url: values.cityUrl }, on(values));
