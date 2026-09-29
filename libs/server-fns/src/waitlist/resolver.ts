import {
  AppError,
  id,
  ok,
  type WaitlistJoinOutcome,
  type Locale,
  type Result,
} from '@founders-coffee/core';
import { insertWaitlistEntry, type Db } from '@founders-coffee/db';

export type JoinWaitlistInput = {
  email: string;
  marketCode: string;
  cityCode: string;
  locale: Locale;
};

export type JoinWaitlistResult = { status: WaitlistJoinOutcome };

/**
 * Join a city's waitlist. Anonymous demand capture — no session required.
 *
 * The composite UNIQUE(email, market_code, city_code) is the idempotency guard: a repeat
 * submission for the same city and market returns `{ status: 'already_waitlisted' }`, and any
 * other database failure still throws.
 */
export const joinWaitlistResolver = async (
  db: Db,
  input: JoinWaitlistInput,
): Promise<Result<JoinWaitlistResult, AppError>> => {
  const result = await insertWaitlistEntry(db, {
    id: id('wait'),
    email: input.email,
    marketCode: input.marketCode,
    cityCode: input.cityCode,
    locale: input.locale,
  });

  return ok(result);
};
