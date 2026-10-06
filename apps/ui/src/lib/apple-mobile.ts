/**
 * Whether `userAgent` belongs to an iPhone, an iPad or an iPod, read from the user agent because
 * nothing a page can feature-detect tells them apart: an iPad asking for desktop sites calls itself a
 * Macintosh and still says Mobile.
 */
export const isAppleMobile = (userAgent: string): boolean =>
  /iphone|ipad|ipod/i.test(userAgent) ||
  (/macintosh/i.test(userAgent) && /mobile/i.test(userAgent));
