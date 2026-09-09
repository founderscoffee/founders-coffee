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
  },
  read: {
    publicProfile: {
      action: 'read_public_profile',
      limit: 60,
      windowMs: 10 * MINUTE_MS,
    },
  },
  otp: {},
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
 * `edit` covers cheap owner writes. `read` covers unauthenticated reads that are cheap per call but
 * enumerable in bulk. `otp` is still declared with no members: OTP sends are governed by Better
 * Auth's own configuration, and an empty category is an honest statement that nothing has claimed
 * it yet rather than a budget invented for an endpoint that does not exist.
 *
 * `expensive` holds the two halves of a photo upload, deliberately as separate buckets: a
 * reservation is cheap and a transferred body is not, so spending the reservation allowance must
 * not also buy the right to send five more megabytes. Five each per ten minutes bounds a member to
 * roughly twenty-five megabytes of transfer and five transformations in that window — the
 * transformation count is what the free tier meters — and the sweeper reclaims whatever those
 * uploads abandoned. The export budget still arrives with PF-09.
 */
export const allRateBudgets = (): ReadonlyArray<
  RateBudget & { category: RateBudgetCategory }
> =>
  (Object.keys(RATE_BUDGETS) as RateBudgetCategory[]).flatMap((category) =>
    Object.values(RATE_BUDGETS[category] as Record<string, RateBudget>).map(
      (budget) => ({ ...budget, category }),
    ),
  );
