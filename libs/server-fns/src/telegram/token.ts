const TOKEN_BYTES = 24;

const base64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
};

const digest = async (value: string): Promise<Uint8Array> =>
  new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );

/**
 * A fresh one-time token for a Connect link.
 *
 * It rides in Telegram's `startgroup` parameter, which takes at most 64 characters from
 * `A-Z a-z 0-9 _ -`, so it is base64url: 192 random bits in 32 characters.
 */
export const createConnectToken = (): string =>
  base64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));

/**
 * What is stored in place of a Connect token.
 *
 * The token is posted into the group as part of `/start`, and a pending one is as good as a key, so
 * only its hash is kept and a read of the table cannot connect a meetup to anything.
 */
export const hashConnectToken = async (token: string): Promise<string> =>
  base64Url(await digest(token));

/**
 * Compare a presented secret with the expected one in time that does not depend on where they differ.
 *
 * Both sides are hashed first, so the comparison always runs over the same thirty-two bytes whatever
 * was sent, and a wrong guess learns nothing from how long it took to be refused.
 */
export const secretsMatch = async (
  presented: string,
  expected: string,
): Promise<boolean> => {
  const [left, right] = await Promise.all([
    digest(presented),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
};
