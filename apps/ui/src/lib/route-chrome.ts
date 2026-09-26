type ChromeMatch = {
  readonly staticData: { readonly hasOwnMobileHeader?: boolean };
};

/**
 * Whether the page on screen draws its own header on a phone, in place of the site's.
 *
 * The host wizard does: below `lg` it needs the height for its map, so its own bar carries the
 * steps and the way home, and the site header would only stack a second bar above it.
 */
export const hasOwnMobileHeader = (matches: readonly ChromeMatch[]): boolean =>
  matches.some((match) => match.staticData.hasOwnMobileHeader === true);
