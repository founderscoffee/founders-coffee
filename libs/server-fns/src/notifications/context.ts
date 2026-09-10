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
 * The canonical page for an event, which is keyed on the market slug and not its code.
 *
 * `/$market/e/$slug` resolves its first segment with `getMarket({ slug })`, so a code lands on
 * `market_not_found` and the route's own canonicalising redirect is never reached. Every reminder
 * this product has ever written carried `/DZ/e/...` and would have sent a member to a not-found
 * page — invisible until now because no push provider has been configured anywhere, so nobody has
 * received one to tap.
 */
export const eventUrlFor = (opts: {
  marketSlug: string;
  eventSlug: string;
}): string => `${notificationBaseUrl()}/${opts.marketSlug}/e/${opts.eventSlug}`;
