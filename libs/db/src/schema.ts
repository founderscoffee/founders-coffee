import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Schema (SRS §7) — owned entirely by `libs/db` (single source of truth for D1).
 *
 * The identity tables (`user`, `session`, `account`, `verification`) are shaped to
 * what Better Auth (1.6.x) expects (SQLite/D1 dialect). `libs/auth` configures
 * Better Auth against this schema via the Drizzle adapter. We keep the columns
 * here — not generated into `libs/auth` — so the data layer owns all persistence
 * and there is one migration source.
 *
 * Auth model (FR-A4/D4): passwordless email-OTP + OAuth (Google/GitHub/LinkedIn).
 * No passwords, no phone. `user.role` is a plain string (Better Auth stores
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

/** Verification — hashed email-OTP codes + tokens (storeOTP: "hashed"). */
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
