import type { Locale } from '@founders-coffee/i18n';

import { storeLocale } from './locale-cookie';

const ignoreFailure = (): undefined => undefined;

/**
 * Record the language the reader just picked, in every place that decides one.
 *
 * The cookie is written first and always: it is what the next server render reads through
 * `detectLocale`, and it is the only store a signed-out reader has.
 *
 * The account row is written whenever there is a session, and that is not politeness. The root
 * layout runs `useStoredLocale`, which reconciles this device against `user.localePref` on every
 * page. A member who changes language with the cookie alone therefore does not merely fail to carry
 * the choice to their next device; the next render sees the account disagreeing and puts the old
 * language back. Writing both is what stops the two halves of the product arguing.
 *
 * `navigate` is passed in rather than reached for, following `adoptStoredLocale`: the one
 * irreversible thing this does stays visible at the call site, and the order below can be observed
 * in a test instead of navigating one. That order is the point. The navigation is a full document
 * load, and a request still in flight when the document is replaced never reaches the server, so
 * the save has to finish first or the reader lands back in the language they just left.
 *
 * A failed save is swallowed. The reader asked to read this page in another language, not to store
 * a setting, and the cookie has already granted that. Refusing the change because the network did
 * would answer a fault with a worse outcome than the one it reports.
 */
export const applyLocaleChoice = async (
  next: Locale,
  {
    persist,
    navigate,
  }: {
    persist?: (locale: Locale) => Promise<unknown>;
    navigate: () => void;
  },
): Promise<void> => {
  storeLocale(next);
  if (persist) await persist(next).catch(ignoreFailure);
  navigate();
};
