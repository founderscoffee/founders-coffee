import { createHash } from 'node:crypto';

const HOUR = 3600;
const DAY = 24 * HOUR;

/*
 * The three launch markets, which must stay byte-identical to `SEED_MARKETS` in
 * `libs/db/src/seed.ts`. They are repeated rather than imported because that module is TypeScript
 * and this tool runs under plain node; `libs/db/src/dev-seed-agreement.test.ts` fails the build if
 * the two ever disagree, so the copy cannot rot quietly.
 */
export const MARKET_ROWS = [
  {
    code: 'DZ',
    name: 'Algeria',
    name_ar: 'الجزائر',
    name_fr: 'Algérie',
    slug: 'algeria',
    default_locale: 'ar',
    default_currency: 'DZD',
    timezone: 'Africa/Algiers',
    direction: 'rtl',
    state: 'active',
  },
  {
    code: 'EG',
    name: 'Egypt',
    name_ar: 'مصر',
    name_fr: 'Égypte',
    slug: 'egypt',
    default_locale: 'ar',
    default_currency: 'EGP',
    timezone: 'Africa/Cairo',
    direction: 'rtl',
    state: 'active',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    name_ar: 'السعودية',
    name_fr: 'Arabie saoudite',
    slug: 'saudi-arabia',
    default_locale: 'ar',
    default_currency: 'SAR',
    timezone: 'Asia/Riyadh',
    direction: 'rtl',
    state: 'active',
  },
];

export const MARKET_FEATURE_FLAGS = {
  events: true,
  hackathons: false,
  payments: false,
  recruiting: false,
  communityOperations: true,
};

/**
 * A stable id in the shape `libs/core`'s factory mints, derived from a name instead of random.
 *
 * The factory is random, which a seed cannot be: re-running has to be a no-op, and a row can only
 * recognise itself on a second run if its id is the same one. The format is unchanged — `idSchema`
 * is `^[a-z]{2,8}_[0-9a-f]{32}$` and a truncated SHA-256 is thirty-two hex digits — so a seeded row
 * is indistinguishable from a minted one at every boundary that validates it. The pleasant side
 * effect is that a local event keeps its URL across reseeds.
 *
 * @param {string} prefix entity prefix, e.g. `evt`.
 * @param {string} key stable name for this row within the seed.
 * @returns {string} an id matching the shared id format.
 */
export const derivedId = (prefix, key) =>
  `${prefix}_${createHash('sha256')
    .update(`founders-coffee/dev-seed/${prefix}/${key}`)
    .digest('hex')
    .slice(0, 32)}`;

/**
 * A stable account id in the shape Better Auth mints.
 *
 * `defaultGenerateId` returns thirty-two characters of `a-zA-Z0-9`; hex is inside that alphabet, so
 * a derived id satisfies `userIdSchema` and looks like every other account. Signing in as one of
 * these is the ordinary email-OTP flow — the address is unroutable and the code is written to the
 * dev server log, which is where you read it.
 *
 * @param {string} email the seeded account's address.
 * @returns {string} a thirty-two character account id.
 */
export const accountId = (email) =>
  createHash('sha256')
    .update(`founders-coffee/dev-seed/account/${email}`)
    .digest('hex')
    .slice(0, 32);

const HOST_EMAIL = 'dev-host@dev.invalid';
const MEMBER_EMAIL = 'dev-member@dev.invalid';
const SECOND_MEMBER_EMAIL = 'dev-member-two@dev.invalid';

export const ACCOUNT_ROWS = [
  {
    id: accountId(HOST_EMAIL),
    name: 'Amina Benali',
    email: HOST_EMAIL,
    email_verified: 1,
    role: 'host',
  },
  {
    id: accountId(MEMBER_EMAIL),
    name: 'Karim Haddad',
    email: MEMBER_EMAIL,
    email_verified: 1,
    role: 'member',
  },
  {
    id: accountId(SECOND_MEMBER_EMAIL),
    name: 'Yasmine Toumi',
    email: SECOND_MEMBER_EMAIL,
    email_verified: 1,
    role: 'member',
  },
];

/**
 * Three events chosen so every operations path has something to run against.
 *
 * `dev-closeout-ready` has ended and holds RSVPs, which is the combination the closeout and
 * feedback commands require and the one no seeded row used to satisfy. `dev-rsvp-open` is still
 * ahead, because §5.17 freezes RSVP intent at `startsAt` and an elapsed event refuses a new one.
 * `dev-cairo-upcoming` sits in a second market so a query that silently crosses markets has
 * something to get wrong.
 *
 * @param {number} now seconds since the epoch, as `unixepoch()` returns them.
 * @returns {{events: object[], rsvps: object[]}} rows ready to insert.
 */
export const eventRows = (now) => {
  const host = accountId(HOST_EMAIL);
  const attendees = [accountId(MEMBER_EMAIL), accountId(SECOND_MEMBER_EMAIL)];

  const events = [
    {
      id: derivedId('evt', 'dev-closeout-ready'),
      slug: 'dev-closeout-ready',
      host_id: host,
      market_code: 'DZ',
      state_code: '16',
      city_code: '556',
      title: 'قهوة المؤسسين — لقاء الجزائر',
      description:
        'لقاء انتهى بالفعل، لتجربة إغلاق اللقاء وإرسال الرأي على جهازك المحلي.',
      venue: 'Café des Délices, Hydra',
      starts_at: now - 4 * HOUR,
      ends_at: now - 2 * HOUR,
      language: 'ar',
      status: 'published',
      rsvps: attendees.length,
    },
    {
      id: derivedId('evt', 'dev-rsvp-open'),
      slug: 'dev-rsvp-open',
      host_id: host,
      market_code: 'DZ',
      state_code: '16',
      city_code: '556',
      title: 'قهوة المؤسسين — لقاء قادم',
      description: 'لقاء لم يبدأ بعد، لتجربة الحضور وإلغاء الحضور محليًا.',
      venue: 'Café des Délices, Hydra',
      starts_at: now + 3 * DAY,
      ends_at: now + 3 * DAY + 2 * HOUR,
      language: 'ar',
      status: 'published',
      rsvps: 0,
    },
    {
      id: derivedId('evt', 'dev-cairo-upcoming'),
      slug: 'dev-cairo-upcoming',
      host_id: host,
      market_code: 'EG',
      state_code: '1',
      city_code: '397',
      title: 'قهوة المؤسسين — لقاء القاهرة',
      description:
        'لقاء في سوق ثانٍ، للتحقق من أن الاستعلامات لا تعبر الأسواق.',
      venue: 'Cairo Coworking, Zamalek',
      starts_at: now + 5 * DAY,
      ends_at: now + 5 * DAY + 2 * HOUR,
      language: 'ar',
      status: 'published',
      rsvps: 0,
    },
  ];

  const rsvps = attendees.map((userId) => ({
    id: derivedId('rsv', `dev-closeout-ready/${userId}`),
    event_id: derivedId('evt', 'dev-closeout-ready'),
    user_id: userId,
    status: 'going',
  }));

  return { events, rsvps };
};
