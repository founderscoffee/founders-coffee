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

/** City — a geographic unit within a market. */
export const cities = sqliteTable('cities', {
  id: text('id').primaryKey(),
  marketCode: text('market_code')
    .notNull()
    .references(() => markets.code),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  timezone: text('timezone').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;

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
