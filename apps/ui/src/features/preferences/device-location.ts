export const GEO_COOKIE = 'fc_geo';

/**
 * The market this browser remembers, so the site opens on the right city.
 *
 * It lives in a cookie on this device and nowhere else: it is not part of the account, does not
 * follow a member to another browser, and is never read by delivery. The preferences screen shows
 * it because a value that decides what a visitor sees should be visible to them, and offers to
 * forget it because a device-local guess is the one kind of stored location a member cannot reach
 * through the account.
 */
export const rememberedMarket = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === GEO_COOKIE);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

/**
 * Drop it, on this device.
 *
 * Expiring rather than blanking, so the cookie is gone rather than present and empty — the next
 * visit resolves the market from the edge again, which is what "forget" has to mean for the member
 * to be able to change it by travelling.
 */
export const forgetRememberedMarket = (): void => {
  if (typeof document === 'undefined') return;
  document.cookie = `${GEO_COOKIE}=; path=/; max-age=0; samesite=lax`;
};

/**
 * The market code to register a push device against, from what this browser already knows.
 *
 * `/profile/notifications` is not market-scoped, so there is no code in the route. The remembered cookie
 * holds a slug, which is matched against the visible markets the root layout already loaded; a
 * browser with no cookie, or one remembering a market that has since gone dark, falls back to the
 * first visible market rather than failing the registration on a foreign key.
 */
export const marketCodeFor = (
  markets: readonly { code: string; slug: string }[],
): string => {
  const remembered = rememberedMarket();
  const match = remembered
    ? markets.find((market) => market.slug === remembered)
    : undefined;
  return match?.code ?? markets[0]?.code ?? 'DZ';
};
