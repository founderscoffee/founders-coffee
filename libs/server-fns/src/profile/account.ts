import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  getAccountSummary,
  updateAccountLocale,
  type AccountSummaryRow,
  type Db,
} from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';
import { logger } from '@founders-coffee/observability';

/**
 * What the account screen may say about an account, masked before it leaves the server.
 *
 * Masking here rather than in the component is the difference between a private value that is
 * displayed carefully and one that is simply not sent. The screen has no use for the raw address —
 * every row on it is informational until PF-07c gives it an action — so the response carries what
 * the member needs to recognise their account and nothing an onlooker could write down.
 *
 * A suppressed or closing identity reads as not found rather than as an empty account, because
 * `activeProfileIdentity` is the same predicate the rest of the owner surface answers to and a
 * second answer here would be a second rule.
 */
export const readAccountSummary = async (
  db: Db,
  userId: string,
): Promise<Result<profile.AccountSummary>> => {
  logger.info('account_summary_requested', { userId, scope: 'owner' });
  try {
    const row = await getAccountSummary(db, userId);
    if (!row) return err(new AppError('not_found', 'Account not found'));

    return ok(toAccountSummary(row, userId));
  } catch {
    logger.error('account_summary_failed', { userId, scope: 'owner' });
    return err(
      new AppError('account_unavailable', 'Account is temporarily unavailable'),
    );
  }
};

const toAccountSummary = (
  row: AccountSummaryRow,
  userId: string,
): profile.AccountSummary =>
  profile.accountSummarySchema.parse({
    userId,
    locale: row.locale,
    email: {
      masked: profile.maskEmail(row.email),
      verified: row.emailVerified,
    },
    phone: {
      masked: profile.maskPhoneNumber(row.phoneNumber),
      verified: row.phoneNumberVerified,
    },
    providers: profile.knownAccountProviders(row.providerIds),
    sessionCount: row.sessionCount,
  });

export const saveAccountLocale = async (
  db: Db,
  userId: string,
  locale: profile.UpdateAccountLocale['locale'],
): Promise<Result<profile.AccountSummary>> => {
  logger.info('account_locale_requested', { userId, scope: 'owner' });
  try {
    const savedLocale = await updateAccountLocale(db, userId, locale);
    if (!savedLocale)
      return err(new AppError('not_found', 'Account not found'));
    const row = await getAccountSummary(db, userId);
    if (!row) return err(new AppError('not_found', 'Account not found'));
    return ok(toAccountSummary(row, userId));
  } catch {
    logger.error('account_locale_failed', { userId, scope: 'owner' });
    return err(
      new AppError('account_unavailable', 'Account is temporarily unavailable'),
    );
  }
};
