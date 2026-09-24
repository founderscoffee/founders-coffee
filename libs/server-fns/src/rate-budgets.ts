export interface RateBudget {
  readonly action: string;
  readonly limit: number;
  readonly windowMs: number;
}

const MINUTE_MS = 60_000;

export const RATE_BUDGETS = {
  edit: {
    profileUpdate: {
      action: 'update_profile',
      limit: 10,
      windowMs: 10 * MINUTE_MS,
    },
    telegramConnect: {
      action: 'connect_telegram_group',
      limit: 10,
      windowMs: 10 * MINUTE_MS,
    },
    telegramDisconnect: {
      action: 'disconnect_telegram_group',
      limit: 10,
      windowMs: 10 * MINUTE_MS,
    },
  },
  read: {
    publicProfile: {
      action: 'read_public_profile',
      limit: 60,
      windowMs: 10 * MINUTE_MS,
    },
  },
  otp: {
    contactCode: {
      action: 'send_contact_code',
      limit: 5,
      windowMs: 10 * MINUTE_MS,
    },
    contactChange: {
      action: 'change_contact',
      limit: 10,
      windowMs: 10 * MINUTE_MS,
    },
  },
  expensive: {
    photoReservation: {
      action: 'reserve_profile_photo',
      limit: 5,
      windowMs: 10 * MINUTE_MS,
    },
    photoUpload: {
      action: 'upload_profile_photo',
      limit: 5,
      windowMs: 10 * MINUTE_MS,
    },
    telegramInvite: {
      action: 'request_telegram_invite',
      limit: 5,
      windowMs: 10 * MINUTE_MS,
    },
  },
  telegram: {
    connectAttempt: {
      action: 'telegram_connect_attempt',
      limit: 10,
      windowMs: 10 * MINUTE_MS,
    },
    joinRequest: {
      action: 'telegram_join_request',
      limit: 60,
      windowMs: 10 * MINUTE_MS,
    },
  },
} as const satisfies Record<string, Record<string, RateBudget>>;

export type RateBudgetCategory = keyof typeof RATE_BUDGETS;

/**
 * Every declared budget, flattened, for invariant tests and coverage assertions.
 *
 * `RATE_BUDGETS` is the single declaration of what each endpoint may spend. Every bucket used to
 * live at its call site as three inline literals, which made two things impossible to see: whether
 * an expensive endpoint had been given an edit-sized budget, and whether two endpoints were quietly
 * sharing one bucket name — a shared name lets a caller spend one endpoint's allowance on another.
 * Naming them once fixes both, and the categories say what a budget is *for* rather than only what
 * it permits.
 *
 * `edit` covers cheap owner writes, a host connecting or disconnecting their meetup's Telegram
 * group among them. `read` covers unauthenticated reads that are cheap per call but enumerable in
 * bulk. `otp` now holds the two halves of a contact change: sending a code costs an SMS or an email
 * and is bounded tightly, while submitting one is cheap but must not become an oracle, so it is
 * bounded loosely. Better Auth applies its own per-endpoint limits underneath; these are the
 * per-identity budgets this product owns, and the two together are the reason a stolen session
 * cannot walk a member's contact details out of the account.
 *
 * `expensive` holds the two halves of a photo upload, deliberately as separate buckets: a
 * reservation is cheap and a transferred body is not, so spending the reservation allowance must
 * not also buy the right to send five more megabytes. Five each per ten minutes bounds a member to
 * roughly twenty-five megabytes of transfer and five transformations in that window — the
 * transformation count is what the free tier meters — and the sweeper reclaims whatever those
 * uploads abandoned. The export budget still arrives with PF-09. A Telegram invite is here too,
 * because making one is a call to the Bot API, whose limits the whole bot shares: five in ten
 * minutes is more than a member going to one meetup ever needs.
 *
 * `telegram` holds what a Telegram chat can spend through the webhook, keyed by chat. The webhook is
 * authenticated, but what arrives through it is whatever anyone in a group chooses to send: a
 * connect command makes the bot look people up and answer in the group, and a join request costs a
 * write and an answer. A connect is a host's one-off step, so ten attempts in ten minutes is plenty;
 * sixty join requests covers a meetup's whole table arriving at once.
 */
export const allRateBudgets = (): ReadonlyArray<
  RateBudget & { category: RateBudgetCategory }
> =>
  (Object.keys(RATE_BUDGETS) as RateBudgetCategory[]).flatMap((category) =>
    Object.values(RATE_BUDGETS[category] as Record<string, RateBudget>).map(
      (budget) => ({ ...budget, category }),
    ),
  );
