import type { CodeSendRequest } from '@founders-coffee/auth';

import { RATE_BUDGETS, type RateBudget } from './rate-budgets.js';
import { consumeRateBudget } from './rate-consume.js';

export const SIGN_IN_CODE_SENDER_BUDGET = RATE_BUDGETS.otp.signInCodeSender;

export const SIGN_IN_CODE_MAILBOX_BUDGET = RATE_BUDGETS.otp.signInCodeMailbox;

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

const spend = (identity: string, budget: RateBudget): Promise<boolean> =>
  consumeRateBudget(identity, budget.action, budget.limit, budget.windowMs);

/**
 * The mailbox an address delivers to, as the key of its budget.
 *
 * A per-mailbox limit that keyed on the address as typed would be no limit at all. Gmail delivers
 * every spelling of an address to one inbox, with any dots in its name and any `+tag` after it, and
 * most providers deliver a `+tag` too, so a sender could reach one inbox under endless new names.
 * The key therefore drops the `+tag` everywhere, and the dots and the googlemail.com alias at Gmail.
 * It is used for counting only: the code still goes to the address as written.
 */
export const mailboxOf = (email: string): string => {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at <= 0) return address;
  const local = address.slice(0, at).split('+')[0] ?? '';
  const domain = address.slice(at + 1);
  return GMAIL_DOMAINS.has(domain)
    ? `${local.replaceAll('.', '')}@gmail.com`
    : `${local}@${domain}`;
};

/**
 * Whether a sign-in code may be mailed to `recipient` at the request of `address`.
 *
 * The sender's budget is spent first, and the mailbox's only if the sender still has one, so an
 * address over its limit cannot also drain the allowance of the mailboxes it names. A refusal from
 * either side refuses the code. Both live in `RateLimiterDO`, like every other budget (AGENTS §10).
 */
export const allowSignInCode = async ({
  recipient,
  address,
}: CodeSendRequest): Promise<boolean> =>
  (await spend(`ip:${address}`, SIGN_IN_CODE_SENDER_BUDGET)) &&
  spend(`mailbox:${mailboxOf(recipient)}`, SIGN_IN_CODE_MAILBOX_BUDGET);
