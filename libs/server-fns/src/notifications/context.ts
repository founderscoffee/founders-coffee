import { env } from 'cloudflare:workers';

import { getMarketByCode, type Db } from '@founders-coffee/db';
import { LOCALES, type Locale } from '@founders-coffee/i18n';

export interface NotificationContext {
  readonly locale: Locale;
  readonly timeZone: string;
  readonly marketSlug: string;
}

const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/**
 * The locale and time zone a notification is written in.
 *
 * Locale follows the documented order: the member's stored preference, then the market default,
 * then `ar` (AGENTS.md §9). The previous fallback was `en`, which inverted it — a member with no
 * stored preference in an Arabic-default market was written to in English.
 *
 * The time zone comes from the market for the same reason §6 gives: timestamps are stored in UTC
 * and rendered where the event happens. Reminders previously formatted with no zone at all, so they
 * rendered in the Worker's UTC and could name the wrong day for an evening event in Algiers.
 *
 * The slug travels too, because the event route is keyed on it and notifications were linking with
 * the market *code*. `/DZ/e/react-workshop-algiers` is a 404 and `/algeria/e/react-workshop-algiers`
 * is the page; the market row is loaded here anyway, so this is where the right one comes from.
 *
 * Falling back to the code keeps the old shape for a market row that does not exist, which the
 * event's foreign key makes unreachable. A link that 404s is a worse answer than a link to another
 * market's page, and this is the only fallback that cannot produce the second.
 */
export const resolveNotificationContext = async (
  db: Db,
  opts: { preferred?: string | null; marketCode: string },
): Promise<NotificationContext> => {
  const market = await getMarketByCode(db, opts.marketCode);
  const marketDefault = market?.defaultLocale?.split('-')[0];
  const locale = isLocale(opts.preferred)
    ? opts.preferred
    : isLocale(marketDefault)
      ? marketDefault
      : 'ar';
  return {
    locale,
    timeZone: market?.timezone ?? 'UTC',
    marketSlug: market?.slug ?? opts.marketCode,
  };
};

/**
 * The origin notifications link to, taken from the deployment rather than a literal.
 *
 * The base URL was hardcoded to production, so a staging reminder sent a member to the live site.
 * `APP_URL` is already set per environment as a wrangler `var`.
 */
export const notificationBaseUrl = (): string =>
  ((env as { APP_URL?: string }).APP_URL ?? 'https://founders.coffee').replace(
    /\/+$/,
    '',
  );

/**
 * The canonical page for an event, in the language the notification itself is written in.
 *
 * Three segments, and each one was wrong at some point. The market is addressed by *slug* and not
 * by code, because the route resolves it with `getMarket({ slug })` and a code lands on
 * `market_not_found`. The locale leads, because `/$market/e/$slug` is a redirect stub: it loads the
 * market and the event, discards both and answers 307 to this address, so the unprefixed form spent
 * two server calls and two document loads before the reader saw anything.
 *
 * And the locale is the one `resolveNotificationContext` already resolved from the member's stored
 * preference, which is the part that was visible to members. That stub picks its language from the
 * reader's cookie, so a member written to in French opened the link in Arabic on any browser that
 * had not visited the site before — the language of the mail and the language of the page it opened
 * disagreed, decided by a cookie neither of them knew about.
 */
export const eventUrlFor = (opts: {
  locale: Locale;
  marketSlug: string;
  eventSlug: string;
}): string =>
  `${notificationBaseUrl()}/${opts.locale}/${opts.marketSlug}/e/${opts.eventSlug}`;

/**
 * The private screen where a host closes a gathering out, in the language of the prompt.
 *
 * Not `eventUrlFor`. That points at the public event page, which says nothing about a closeout and
 * would leave a host who tapped the prompt exactly where they started — the failure that made every
 * reminder link to a 404 until it was measured.
 *
 * The locale leads for the same reason it leads on an event link. These screens are private and a
 * crawler will never see one, so the prefix is not serving a canonical; it is the only way the link
 * can carry its own language. Unprefixed, the page settles from the reader's cookie, so a host
 * prompted in French closed out in Arabic on any browser that had not visited the site before.
 */
export const closeoutUrlFor = (locale: Locale, eventId: string): string =>
  `${notificationBaseUrl()}/${locale}/closeout/${eventId}`;

/** The screen where an attendee leaves feedback, on the same terms as `closeoutUrlFor`. */
export const feedbackUrlFor = (locale: Locale, eventId: string): string =>
  `${notificationBaseUrl()}/${locale}/feedback/${eventId}`;
