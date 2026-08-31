/** Generate initials from a name (first letter of each word, max 2 chars). */
export const initials = (name: string): string =>
  name
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
