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
  },
  chat: {
    connect: {
      action: 'connect_chat',
      limit: 30,
      windowMs: 10 * MINUTE_MS,
    },
    send: {
      action: 'send_chat_message',
      limit: 20,
      windowMs: MINUTE_MS,
    },
    remove: {
      action: 'remove_chat_message',
      limit: 30,
      windowMs: 10 * MINUTE_MS,
    },
    markRead: {
      action: 'mark_chat_read',
      limit: 120,
      windowMs: 10 * MINUTE_MS,
    },
    mute: {
      action: 'mute_chat',
      limit: 20,
      windowMs: 10 * MINUTE_MS,
    },
    report: {
      action: 'report_chat_message',
      limit: 10,
      windowMs: 10 * MINUTE_MS,
    },
  },
  telemetry: {
    clientLogs: {
      action: 'client_logs',
      limit: 30,
      windowMs: 10 * MINUTE_MS,
    },
    clientLogsRefusal: {
      action: 'client_logs_refusal',
      limit: 1,
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
 * enumerable in bulk. `otp` now holds the two halves of a contact change: sending a code costs an SMS or an email
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
 * uploads abandoned. The export budget still arrives with PF-09.
 *
 * `chat` holds what a member spends in a meetup's chat (P1-026). Twenty messages a minute keeps a
 * lively table talking and stops one member flooding it. A removal is a cheap write, with room for
 * a host clearing out a flood, and so is a read marker, which a member's screen moves as the chat
 * scrolls. A report asks a moderator for their attention, so it is the scarcest. Each socket a page
 * opens to the chat's room costs a connection, thirty in ten minutes: a panel opened and reopened
 * across five tabs, with room for a patchy network, while a page that reconnects in a loop runs dry.
 *
 * `telemetry` holds what a browser spends reporting its errors to `/client-logs` (P1-018), counted
 * against its address, since a beacon carries no session. Only a failure makes an entry, and the
 * client logger sends a batch when ten have gathered or when its page is hidden, so a page that
 * works sends nothing and one that fails sends a batch or two. Thirty batches in ten minutes is out
 * of a page's reach unless it fails in a loop, with room for several visitors on one network; past
 * them, batches pass only as the bucket refills, three a minute, and the rest are dropped unread. A
 * refusal is logged from a budget of its own, one line per address in ten minutes, so the line
 * saying a caller is limited cannot fill the log in place of the batches it stands for.
 */
export const allRateBudgets = (): ReadonlyArray<
  RateBudget & { category: RateBudgetCategory }
> =>
  (Object.keys(RATE_BUDGETS) as RateBudgetCategory[]).flatMap((category) =>
    Object.values(RATE_BUDGETS[category] as Record<string, RateBudget>).map(
      (budget) => ({ ...budget, category }),
    ),
  );
