import type { MakeRouteMatchUnion } from '@tanstack/react-router';

type ChromeMatch = {
  readonly staticData: {
    readonly hasOwnMobileHeader?: boolean;
    readonly isFocusedTask?: boolean;
  };
};

/**
 * Whether the page on screen draws its own header on a phone, in place of the site's.
 *
 * The host wizard does: below `lg` it needs the height for its map, so its own bar carries the
 * steps and the way home, and the site header would only stack a second bar above it.
 */
export const hasOwnMobileHeader = (matches: readonly ChromeMatch[]): boolean =>
  matches.some((match) => match.staticData.hasOwnMobileHeader === true);

/**
 * Whether the page on screen is a task the reader is in the middle of, which nothing unasked opens over.
 *
 * Signing in, setting up a profile, the host wizard, and editing, closing out or reviewing a meetup
 * are each a form being worked through. The install sheet waits for the next page rather than cover
 * a code field or a form's last button.
 */
export const isFocusedTask = (matches: readonly ChromeMatch[]): boolean =>
  matches.some((match) => match.staticData.isFocusedTask === true);

/**
 * The code of the city the page on screen is about, for the site's Host links to open the wizard on.
 *
 * A city's page, a meetup's page and the wizard itself each know their city. The header's Host link
 * did not pass it on, so a reader who went from Algiers' page to host a meetup there arrived on the
 * whole market and was asked where they were. Every other page names no city, and the wizard asks.
 */
export const cityCodeInView = (
  matches: readonly MakeRouteMatchUnion[],
): string | undefined => {
  for (const match of matches) {
    if (match.routeId === '/$locale/$market/$city') {
      return match.loaderData?.city.code;
    }
    if (match.routeId === '/$locale/$market/e/$slug') {
      return match.loaderData?.event.cityCode;
    }
    if (match.routeId === '/$locale/$market/host/create') {
      return match.loaderData?.city?.code;
    }
  }
  return undefined;
};
