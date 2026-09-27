import { getUser, replaceUserName, type Db } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';
import { reportError } from '@founders-coffee/observability';

/**
 * The name a new account is created with (#119): the one its sign-up brought when that is usable,
 * or else the one its email reads as. An email sign-up brings none, so this is where its member's
 * name comes from, with no step after sign-in to ask for one.
 */
export const nameForNewAccount = (account: {
  name?: string | null;
  email: string;
}): string => profile.startingDisplayName(account.name ?? '', account.email);

/**
 * Give a member who signs in without a usable name the one their email reads as (#119).
 *
 * New accounts are named when they are created. This reaches the accounts created before that,
 * which the retired name step used to catch at every sign-in. The write lands only while the name
 * is still the one read, so a name the member saves in between wins. A failure is reported and
 * never costs the member their sign-in.
 */
export const nameUnnamedMember = async (
  db: Db,
  userId: string,
): Promise<void> => {
  try {
    const member = await getUser(db, userId);
    if (!member || profile.safeProfileDisplayName(member.name, member.email)) {
      return;
    }
    const name = profile.displayNameFromEmail(member.email);
    if (name) {
      await replaceUserName(db, { userId, expected: member.name, name });
    }
  } catch (error) {
    reportError(error, { operation: 'name_unnamed_member', userId });
  }
};
