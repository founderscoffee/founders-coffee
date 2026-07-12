import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Schema (SRS §7) — owned entirely by `libs/db` (single source of truth for D1).
 *
 * The identity tables (`user`, `session`, `account`, `verification`) are shaped to
 * what Better Auth (1.6.x) expects (SQLite/D1 dialect). `libs/auth` configures
 * Better Auth against this schema via the Drizzle adapter. We keep the columns
 * here — not generated into `libs/auth` — so the data layer owns all persistence
 * and there is one migration source.
 *
 * Auth model (FR-A4/D4): passwordless phone-OTP (Twilio Verify, primary) + email-OTP (secondary/billing) + OAuth (Google/GitHub/LinkedIn).
 * No passwords. `user.role` is a plain string (Better Auth stores
 * roles as text; a DB enum cannot represent the plugin's model) constrained in
 * app code via the RBAC map in `libs/auth`.
 */

/** Per-market feature flags, stored as JSON on the market row. */
type MarketFeatureFlags = {
  events: boolean;
  hackathons: boolean;
  payments: boolean;
  recruiting: boolean;
};

/** Market — a country configuration (DZ | MA | EG | SA | AE). */
export const markets = sqliteTable('markets', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  slug: text('slug').notNull().unique(),
  defaultLocale: text('default_locale').notNull(),
  defaultCurrency: text('default_currency', {
    enum: ['DZD', 'MAD', 'EGP', 'SAR', 'AED'],
  }).notNull(),
  timezone: text('timezone').notNull(),
  direction: text('direction', { enum: ['rtl', 'ltr'] }).notNull(),
  state: text('state', { enum: ['dark', 'open', 'active'] }).notNull(),
  featureFlags: text('feature_flags', { mode: 'json' })
    .$type<MarketFeatureFlags>()
    .notNull(),
  brandOverrides: text('brand_overrides', { mode: 'json' }).$type<
    Record<string, unknown>
  >(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;

/* -------------------------------------------------------------------------- */
/* Better Auth identity tables                                                 */
/* -------------------------------------------------------------------------- */

/** User — global identity (Better Auth core + admin plugin + our additional fields). */
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  role: text('role').notNull().default('member'),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp' }),
  homeMarketCode: text('home_market_code').references(() => markets.code),
  homeState: text('home_state'),
  homeCityId: text('home_city_id'),
  phoneNumber: text('phone_number'),
  phoneNumberVerified: integer('phone_number_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  localePref: text('locale_pref'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

/** Session — sessions live in D1, never KV (AGENTS.md §11.5). */
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  impersonatedBy: text('impersonated_by'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

/** Account — OAuth providers (google/github/linkedin). No credential accounts (passwordless). */
export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', {
    mode: 'timestamp',
  }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

/** Verification — hashed OTP codes + tokens (storeOTP: "hashed"). Used for both phone-OTP and email-OTP. */
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

/* -------------------------------------------------------------------------- */
/* Events (P1-005) — free local meetups (FR-E1/E2/E4)                         */
/* -------------------------------------------------------------------------- */

export const EVENT_LANGUAGES = ['ar', 'en', 'fr', 'ar_en', 'ar_fr'] as const;
export const EVENT_CATEGORIES = ['coffee-meetup', 'workshop', 'demo-day'] as const;
export const EVENT_STATUSES = ['published', 'cancelled'] as const;

/** Event — a free local meetup created by a host (FR-E1). Always `is_free` (FR-E2). */
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  hostId: text('host_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  marketCode: text('market_code')
    .notNull()
    .references(() => markets.code),
  stateCode: text('state_code').notNull(),
  cityCode: text('city_code').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  venue: text('venue').notNull(),
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  rsvps: integer('rsvps').notNull().default(0),
  capacity: integer('capacity').notNull().default(0),
  language: text('language', { enum: [...EVENT_LANGUAGES] }).notNull(),
  category: text('category', { enum: [...EVENT_CATEGORIES] }).notNull(),
  isFree: integer('is_free', { mode: 'boolean' }).notNull().default(true),
  latitude: real('latitude'),
  longitude: real('longitude'),
  venueAddress: text('venue_address'),
  slug: text('slug').notNull(),
  status: text('status', { enum: [...EVENT_STATUSES] }).notNull().default('published'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

/* -------------------------------------------------------------------------- */
/* RSVPs (P1-008) — event attendance + atomic capacity                         */
/* -------------------------------------------------------------------------- */

export const RSVP_STATUSES = ['going', 'waitlist', 'cancelled'] as const;

/** Event RSVP — one per user per event (UNIQUE constraint). Drives the atomic capacity check. */
export const eventRsvps = sqliteTable('event_rsvps', {
  id: text('id').primaryKey(),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  status: text('status', { enum: [...RSVP_STATUSES] })
    .notNull()
    .default('going'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  eventIdUserIdUnique: uniqueIndex('event_rsvps_event_id_user_id_unique').on(t.eventId, t.userId),
  userIdIdx: index('event_rsvps_user_id_index').on(t.userId),
}));

export type EventRsvp = typeof eventRsvps.$inferSelect;
export type NewEventRsvp = typeof eventRsvps.$inferInsert;

/* -------------------------------------------------------------------------- */
/* Payments (P0-015) — B2B Order/Invoice, Year-1 manual confirmation           */
/* -------------------------------------------------------------------------- */

export const ORDER_PURPOSES = [
  'sponsorship',
  'hosted_challenge_fee',
  'prize_payout',
  'host_fee',
] as const;
export type OrderPurpose = (typeof ORDER_PURPOSES)[number];

export const ORDER_STATUSES = ['pending', 'paid', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const CURRENCIES = ['DZD', 'MAD', 'EGP', 'SAR', 'AED'] as const;

/**
 * Order — a generic B2B payment record (FR-P3). Pays for a sponsorship, hosted
 * challenge, prize payout, or host fee (polymorphic `referenceType`/`referenceId`,
 * decoupled from any one entity). Manually confirmed in Year 1 (FR-M5); gateway
 * providers arrive behind the PaymentProvider interface in P4.
 */
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  marketCode: text('market_code')
    .notNull()
    .references(() => markets.code),
  purpose: text('purpose', { enum: [...ORDER_PURPOSES] }).notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  payerUserId: text('payer_user_id').references(() => user.id),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency', { enum: [...CURRENCIES] }).notNull(),
  status: text('status', { enum: [...ORDER_STATUSES] }).notNull().default('pending'),
  provider: text('provider').notNull().default('manual'),
  providerRef: text('provider_ref'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  refundedAt: integer('refunded_at', { mode: 'timestamp' }),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

/** Invoice — 1:1 with an Order; the bill record issued to the payer. */
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  number: text('number').notNull().unique(),
  billToName: text('bill_to_name').notNull(),
  billToEmail: text('bill_to_email').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency', { enum: [...CURRENCIES] }).notNull(),
  notes: text('notes'),
  issuedAt: integer('issued_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

/* -------------------------------------------------------------------------- */
/* Notifications (P1-009) — scheduled SMS + email notifications               */
/* -------------------------------------------------------------------------- */

export const NOTIFICATION_CHANNELS = ['sms', 'email', 'push'] as const;
export const NOTIFICATION_STATUSES = [
  'pending',
  'sent',
  'delivered',
  'failed',
] as const;
export const NOTIFICATION_TEMPLATE_KEYS = [
  'rsvp_confirmation',
  'reminder_72h',
  'reminder_24h',
] as const;

/**
 * Scheduled notification — one row per notification to send.
 * The Cron sweep (worker-jobs) reads `pending` rows where `send_at <= now`,
 * dispatches via the queue, and marks them `sent`/`failed`.
 *
 * `payload` is a JSON blob containing template-specific data (phone number,
 * event title, starts_at, locale, etc.) — the consumer parses it and renders
 * the SMS text or email HTML.
 *
 * `fallback_channel` triggers email retry when SMS fails permanently (3 attempts).
 */
export const scheduledNotifications = sqliteTable(
  'scheduled_notifications',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: [...NOTIFICATION_CHANNELS] })
      .notNull()
      .default('sms'),
    status: text('status', { enum: [...NOTIFICATION_STATUSES] })
      .notNull()
      .default('pending'),
    templateKey: text('template_key', {
      enum: [...NOTIFICATION_TEMPLATE_KEYS],
    }).notNull(),
    payload: text('payload', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull(),
    sendAt: integer('send_at', { mode: 'timestamp' }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    fallbackChannel: text('fallback_channel', {
      enum: ['email'],
    }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pendingIdx: index('idx_scheduled_notifications_pending').on(t.sendAt).where(sql`status = 'pending'`),
    eventIdIdx: index('scheduled_notifications_event_id_index').on(t.eventId),
    userIdIdx: index('scheduled_notifications_user_id_index').on(t.userId),
  }),
);

export type ScheduledNotification =
  typeof scheduledNotifications.$inferSelect;
export type NewScheduledNotification =
  typeof scheduledNotifications.$inferInsert;

/* -------------------------------------------------------------------------- */
/* Push subscriptions (P1-010) — web push via FCM HTTP v1                      */
/* -------------------------------------------------------------------------- */

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;
export const PUSH_SURFACES = ['pwa', 'rn'] as const;

/**
 * Push subscription — one row per device token. Multiple tokens per user
 * (multi-device). Invalidated on logout or `DeviceNotRegistered` response.
 * Tokens are registered on app install / login.
 */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  platform: text('platform', { enum: [...PUSH_PLATFORMS] }).notNull(),
  surface: text('surface', { enum: [...PUSH_SURFACES] }).notNull(),
  marketCode: text('market_code')
    .notNull()
    .references(() => markets.code),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

/**
 * City waitlist — anonymous demand capture for empty cities (FR-E6 "emptiness reads as invitation").
 * When a user searches a city with zero events, they can leave their email to be notified when the
 * first meetup launches. Same email can waitlist multiple cities (one row per city), but not the
 * same city twice — enforced by the composite unique index. `notifiedAt` is set when the first-event
 * notification fires, so the reverse loop (host creates event → email all waitlist entries) can
 * distinguish pending from notified.
 */
export const cityWaitlist = sqliteTable(
  'city_waitlist',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    cityCode: text('city_code').notNull(),
    locale: text('locale').notNull(),
    notifiedAt: integer('notified_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    emailCityUnique: uniqueIndex('city_waitlist_email_city_unique').on(t.email, t.cityCode),
    cityCodeIdx: index('city_waitlist_city_code_index').on(t.cityCode),
  }),
);

export type CityWaitlistRow = typeof cityWaitlist.$inferSelect;
export type NewCityWaitlist = typeof cityWaitlist.$inferInsert;
