/**
 * A text's first character as a whole code point. A character outside the Basic Multilingual Plane,
 * as most emoji are, takes two UTF-16 units, and the first of them alone is a lone surrogate: the
 * server's HTML carries U+FFFD in its place while the browser renders the half, so hydration fails
 * on it.
 */
export const firstCharacter = (text: string): string =>
  Array.from(text)[0] ?? '';

/** Generate initials from a name: the first letter of its first two words, capitalised. */
export const initials = (name: string): string =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map(firstCharacter)
    .join('')
    .toUpperCase();
