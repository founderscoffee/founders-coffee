import { env } from 'cloudflare:workers';

import { getMarketByCode, type Db } from '@founders-coffee/db';
import { LOCALES, type Locale } from '@founders-coffee/i18n';

export interface NotificationContext {
  readonly locale: Locale;
  readonly timeZone: string;
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
  return { locale, timeZone: market?.timezone ?? 'UTC' };
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

export const eventUrlFor = (opts: {
  marketCode: string;
  eventSlug: string;
}): string => `${notificationBaseUrl()}/${opts.marketCode}/e/${opts.eventSlug}`;
