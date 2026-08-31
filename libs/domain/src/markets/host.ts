/**
 * Extract a 2-letter market code from a subdomain-style hostname (`dz.founders.coffee` → `'DZ'`).
 * Returns `undefined` when the host has no leading 2-letter label. An **optional** secondary
 * resolver — the SRS does not require subdomain routing; the primary key is the market code/slug.
 */
export const parseMarketCodeFromHost = (
  hostname: string | null,
): string | undefined => {
  if (!hostname) return undefined;
  const first = hostname.split('.')[0]?.toUpperCase();
  return first && /^[A-Z]{2}$/.test(first) ? first : undefined;
};
