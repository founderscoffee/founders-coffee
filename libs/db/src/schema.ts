import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Initial schema (SRS §7): Market, City, User.
 * Drizzle SQLite dialect — D1 is SQLite-based; the same schema is portable to
 * Postgres via Drizzle if/when we migrate (§8.7 escape hatch).
 *
 * The DB layer owns its own persistence types (it does not import domain types
 * from core — a deliberate layering that keeps `libs/db` standalone and avoids
 * coupling the persistence representation to the domain representation).
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

/** User — global identity, market/city scoping (FR-A). */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  role: text('role', {
    enum: ['member', 'host', 'sponsor_contact', 'moderator', 'admin'],
  }).notNull(),
  homeMarketCode: text('home_market_code').references(() => markets.code),
  homeCityId: text('home_city_id'),
  localePref: text('locale_pref'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
