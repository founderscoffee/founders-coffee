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
  expensive: {},
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
 * enumerable in bulk. `otp` and `expensive` are declared with no members on purpose: OTP sends are
 * still governed by Better Auth's own configuration, and upload/export budgets arrive with PF-06
 * and PF-09. An empty category is an honest statement that nothing has claimed it yet; inventing a
 * budget for an endpoint that does not exist would be a claim that it is protected.
 */
export const allRateBudgets = (): ReadonlyArray<
  RateBudget & { category: RateBudgetCategory }
> =>
  (Object.keys(RATE_BUDGETS) as RateBudgetCategory[]).flatMap((category) =>
    Object.values(RATE_BUDGETS[category] as Record<string, RateBudget>).map(
      (budget) => ({ ...budget, category }),
    ),
  );
