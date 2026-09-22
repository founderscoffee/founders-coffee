import { sql } from 'drizzle-orm';
import {
  index,
  foreignKey,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import {
  ACCOUNT_STATES,
  ATTENDANCE_OUTCOMES,
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  CLOSEOUT_OUTCOMES,
  CURRENCY_CODES,
  EVENT_STATUSES,
  FEEDBACK_RATINGS,
  HOST_TRUST_STATUSES,
  LOCALES,
  MARKET_DIRECTIONS,
  MARKET_STATES,
  METRIC_KEYS,
  NOTIFICATION_DELIVERY_CHANNELS,
  NOTIFICATION_FALLBACK_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATE_KEYS,
  OPERATIONS_SCOPES,
  OPERATION_REASONS,
  ORDER_PURPOSES,
  ORDER_STATUSES,
  PROFILE_ASSET_STATUSES,
  PROFILE_PHOTO_MIME_TYPES,
  PUSH_PLATFORMS,
  PUSH_SURFACES,
  REVIEW_BOTTLENECKS,
  RSVP_STATUSES,
  USER_ROLES,
} from '@founders-coffee/core';

export {
  ATTENDANCE_OUTCOMES,
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  CLOSEOUT_OUTCOMES,
  EVENT_STATUSES,
  FEEDBACK_RATINGS,
  HOST_TRUST_STATUSES,
  METRIC_KEYS,
  NOTIFICATION_DELIVERY_CHANNELS as NOTIFICATION_CHANNELS,
  NOTIFICATION_FALLBACK_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATE_KEYS,
  OPERATIONS_SCOPES,
  OPERATION_REASONS,
  ORDER_PURPOSES,
  ORDER_STATUSES,
  PROFILE_ASSET_STATUSES,
  PROFILE_PHOTO_MIME_TYPES,
  PUSH_PLATFORMS,
  PUSH_SURFACES,
  REVIEW_BOTTLENECKS,
  RSVP_LIFECYCLE_TEMPLATE_KEYS,
  RSVP_STATUSES,
  USER_ROLES,
} from '@founders-coffee/core';

export type { OrderPurpose, OrderStatus } from '@founders-coffee/core';

type MarketFeatureFlags = {
  events: boolean;
  hackathons: boolean;
  payments: boolean;
  recruiting: boolean;
  communityOperations?: boolean;
};

export const markets = sqliteTable('markets', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  nameFr: text('name_fr'),
  slug: text('slug').notNull().unique(),
  defaultLocale: text('default_locale', { enum: [...LOCALES] }).notNull(),
  defaultCurrency: text('default_currency', {
    enum: [...CURRENCY_CODES],
  }).notNull(),
  timezone: text('timezone').notNull(),
  direction: text('direction', { enum: [...MARKET_DIRECTIONS] }).notNull(),
  state: text('state', { enum: [...MARKET_STATES] }).notNull(),
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

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  role: text('role', { enum: [...USER_ROLES] })
    .notNull()
    .default('member'),
  accountState: text('account_state', { enum: [...ACCOUNT_STATES] })
    .notNull()
    .default('active'),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp' }),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: integer('phone_number_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  localePref: text('locale_pref', { enum: [...LOCALES] }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export const session = sqliteTable(
  'session',
  {
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
  },
  (table) => [uniqueIndex('session_id_user_unique').on(table.id, table.userId)],
);

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

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

/**
 * Event — a free local meetup created by a host (FR-E1). Every event is free (FR-E2).
 *
 * `version` exists so an edit can refuse to land on a row that moved underneath it. `updated_at`
 * looks like it would do the same job and does not: it is second-resolution, so two saves inside
 * one second both match a timestamp guard and the later one silently wins. An edit here is not a
 * private document — changing the time notifies everyone who booked — so a lost update is a
 * message sent about a change nobody made. The counter is incremented by the conditional update
 * itself, which is what makes the guard exact rather than probable.
 *
 * The counter is published with the event rather than held back. A host editing a meetup has to
 * send the version they were looking at, and the page they were looking at is the ordinary event
 * response — so withholding it would mean a second request whose only job is to fetch a number. It
 * carries no personal content: the most it tells a reader is how many times this gathering has been
 * corrected.
 *
 * `slug` is deliberately not derived again after creation. It is generated from the title once,
 * and every link a host has already shared points at it, so a retitled meetup keeps its address
 * rather than 404ing the message sitting in somebody's WhatsApp thread.
 */
export const events = sqliteTable(
  'events',
  {
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
    language: text('language', { enum: [...LOCALES] }).notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    venueAddress: text('venue_address'),
    slug: text('slug').notNull(),
    status: text('status', { enum: [...EVENT_STATUSES] })
      .notNull()
      .default('published'),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => [
    uniqueIndex('events_market_code_slug_unique').on(
      table.marketCode,
      table.slug,
    ),
    index('events_host_id_index').on(table.hostId),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

/** Event RSVP — one per user per event (UNIQUE constraint). */
export const eventRsvps = sqliteTable(
  'event_rsvps',
  {
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
  },
  (t) => ({
    eventIdUserIdUnique: uniqueIndex('event_rsvps_event_id_user_id_unique').on(
      t.eventId,
      t.userId,
    ),
    userIdIdx: index('event_rsvps_user_id_index').on(t.userId),
  }),
);

export type EventRsvp = typeof eventRsvps.$inferSelect;
export type NewEventRsvp = typeof eventRsvps.$inferInsert;

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
  currency: text('currency', { enum: [...CURRENCY_CODES] }).notNull(),
  status: text('status', { enum: [...ORDER_STATUSES] })
    .notNull()
    .default('pending'),
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

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  number: text('number').notNull().unique(),
  billToName: text('bill_to_name').notNull(),
  billToEmail: text('bill_to_email').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency', { enum: [...CURRENCY_CODES] }).notNull(),
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

/**
 * Scheduled notification — one row per notification to send.
 * The Cron sweep (worker-jobs) reads the oldest `pending` rows where `send_at <= now`, dispatches
 * each on its channel, and resolves every one it selected. A retryable failure keeps the row
 * `pending` with `attempts` incremented and `send_at` deferred; the row goes terminally `failed`
 * once the attempt budget is spent or the provider reports a permanent error.
 *
 * `payload` is a JSON blob containing template-specific data (phone number,
 * event title, starts_at, locale, etc.) — the consumer parses it and renders
 * the SMS text or email HTML.
 *
 * `fallback_channel` names the channel to try once this row fails terminally. `fallback_of` points
 * the resulting row back at the one it replaces and is UNIQUE, so a parent can spawn at most one
 * fallback however many times the failure path runs.
 *
 * `cancelled` is terminal and distinct from `failed`: the notification was retired because the RSVP
 * or event went away, not because delivery did not work.
 *
 * `processing` is the in-flight claim. A sweep moves due rows into it atomically before dispatching
 * anything, so an overlapping sweep sees no rows left to take. `claimed_at` bounds that claim: an
 * invocation that dies mid-run leaves rows `processing` forever otherwise, and a later sweep
 * reclaims anything older than the claim timeout.
 *
 * `dispatch_started_at` separates the two ways a claim can be abandoned. Cleared on every
 * resolution and set immediately before the provider call, it is the only record that an outbound
 * message may already have been accepted. A reclaimed row with it unset never reached a provider
 * and is safe to retry; one with it set has an unknown outcome, and resending it is a duplicate
 * unless the channel can suppress one.
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
    channel: text('channel', { enum: [...NOTIFICATION_DELIVERY_CHANNELS] })
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
      enum: [...NOTIFICATION_FALLBACK_CHANNELS],
    }),
    fallbackOf: text('fallback_of'),
    claimedAt: integer('claimed_at', { mode: 'timestamp' }),
    dispatchStartedAt: integer('dispatch_started_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pendingIdx: index('idx_scheduled_notifications_pending')
      .on(t.sendAt)
      .where(sql`status = 'pending'`),
    eventIdIdx: index('scheduled_notifications_event_id_index').on(t.eventId),
    userIdIdx: index('scheduled_notifications_user_id_index').on(t.userId),
    fallbackOfUnique: uniqueIndex(
      'scheduled_notifications_fallback_of_unique',
    ).on(t.fallbackOf),
    processingIdx: index('idx_scheduled_notifications_processing')
      .on(t.claimedAt)
      .where(sql`status = 'processing'`),
  }),
);

export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type NewScheduledNotification =
  typeof scheduledNotifications.$inferInsert;

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
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
  },
  (table) => [
    uniqueIndex('push_subscription_id_user_unique').on(table.id, table.userId),
  ],
);

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
    locale: text('locale', { enum: [...LOCALES] }).notNull(),
    notifiedAt: integer('notified_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    emailCityUnique: uniqueIndex('city_waitlist_email_city_unique').on(
      t.email,
      t.cityCode,
    ),
    cityCodeIdx: index('city_waitlist_city_code_index').on(t.cityCode),
  }),
);

export type CityWaitlistRow = typeof cityWaitlist.$inferSelect;
export type NewCityWaitlist = typeof cityWaitlist.$inferInsert;

export const profileAssets = sqliteTable(
  'profile_assets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull().unique(),
    status: text('status', { enum: [...PROFILE_ASSET_STATUSES] })
      .notNull()
      .default('pending'),
    mimeType: text('mime_type', { enum: [...PROFILE_PHOTO_MIME_TYPES] }),
    byteSize: integer('byte_size'),
    width: integer('width'),
    height: integer('height'),
    revision: integer('revision').notNull().default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('profile_asset_id_user_unique').on(table.id, table.userId),
    index('profile_assets_expiry_index').on(table.status, table.expiresAt),
  ],
);

export const memberProfiles = sqliteTable(
  'member_profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    introduction: text('introduction'),
    interests: text('interests', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    spokenLanguages: text('spoken_languages', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    professionalLink: text('professional_link'),
    photoAssetId: text('photo_asset_id'),
    publishInterests: integer('publish_interests', { mode: 'boolean' })
      .notNull()
      .default(false),
    publishSpokenLanguages: integer('publish_spoken_languages', {
      mode: 'boolean',
    })
      .notNull()
      .default(false),
    publishProfessionalLink: integer('publish_professional_link', {
      mode: 'boolean',
    })
      .notNull()
      .default(false),
    revision: integer('revision').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    foreignKey({
      columns: [table.photoAssetId, table.userId],
      foreignColumns: [profileAssets.id, profileAssets.userId],
    }),
  ],
);

export const accountPreferences = sqliteTable('account_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  eventUpdates: integer('event_updates', { mode: 'boolean' })
    .notNull()
    .default(true),
  eventUpdatesChannels: integer('event_updates_channels').notNull().default(5),
  eventReminders: integer('event_reminders', { mode: 'boolean' })
    .notNull()
    .default(true),
  eventRemindersChannels: integer('event_reminders_channels')
    .notNull()
    .default(5),
  hostRsvpReceived: integer('host_rsvp_received', { mode: 'boolean' })
    .notNull()
    .default(true),
  hostRsvpReceivedChannels: integer('host_rsvp_received_channels')
    .notNull()
    .default(5),
  hostRsvpCancelled: integer('host_rsvp_cancelled', { mode: 'boolean' })
    .notNull()
    .default(true),
  hostRsvpCancelledChannels: integer('host_rsvp_cancelled_channels')
    .notNull()
    .default(5),
  followUpPrompts: integer('follow_up_prompts', { mode: 'boolean' })
    .notNull()
    .default(true),
  followUpPromptsChannels: integer('follow_up_prompts_channels')
    .notNull()
    .default(4),
  pushEnabled: integer('push_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  smsFallbackEnabled: integer('sms_fallback_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  smsConsentAt: integer('sms_consent_at', { mode: 'timestamp' }),
  revision: integer('revision').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const pushSessionLinks = sqliteTable(
  'push_session_links',
  {
    subscriptionId: text('subscription_id').primaryKey(),
    sessionId: text('session_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    foreignKey({
      columns: [table.subscriptionId, table.userId],
      foreignColumns: [pushSubscriptions.id, pushSubscriptions.userId],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.sessionId, table.userId],
      foreignColumns: [session.id, session.userId],
    }).onDelete('cascade'),
    index('push_session_links_session_index').on(table.sessionId),
  ],
);

export type MemberProfileRow = typeof memberProfiles.$inferSelect;
export type ProfileAssetRow = typeof profileAssets.$inferSelect;
export type AccountPreferencesRow = typeof accountPreferences.$inferSelect;

/**
 * One row per event, written after it is over, saying whether it happened.
 *
 * Keyed by `event_id` rather than a generated id: an event has exactly one outcome, and a surrogate
 * key would permit two rows that disagree. Publication status stays where it is and keeps deciding
 * visibility — outcome and publication are separate fields deliberately, so a cancelled event and one that quietly did
 * not happen remain distinguishable.
 *
 * `version` is what makes a correction conditional. Two admins correcting the same closeout without
 * it is a last-write-wins race over evidence, which is the one kind of data this plan cannot let
 * drift.
 */
export const eventCloseouts = sqliteTable(
  'event_closeouts',
  {
    eventId: text('event_id')
      .primaryKey()
      .references(() => events.id, { onDelete: 'cascade' }),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    stateCode: text('state_code').notNull(),
    cityCode: text('city_code').notNull(),
    outcome: text('outcome', { enum: [...CLOSEOUT_OUTCOMES] }).notNull(),
    walkInCount: integer('walk_in_count').notNull().default(0),
    wouldHostAgain: integer('would_host_again', { mode: 'boolean' }),
    hostFriction: text('host_friction', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    privateNote: text('private_note'),
    submittedByUserId: text('submitted_by_user_id')
      .notNull()
      .references(() => user.id),
    submittedAt: integer('submitted_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedByUserId: text('updated_by_user_id').references(() => user.id),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('event_closeouts_market_outcome_index').on(
      table.marketCode,
      table.outcome,
      table.submittedAt,
    ),
  ],
);

/**
 * One member's outcome for one event: they came, or they did not.
 *
 * `UNIQUE(event_id, user_id)` is the idempotency: a host marking the same person twice updates one
 * row rather than inflating a count. Attendance is kept separate from the RSVP so cancellation and
 * waitlist semantics stay intact — an attendance row is evidence about the past and an RSVP is
 * intent about the future, and overloading one with the other loses both.
 */
export const eventAttendance = sqliteTable(
  'event_attendance',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    stateCode: text('state_code').notNull(),
    cityCode: text('city_code').notNull(),
    outcome: text('outcome', { enum: [...ATTENDANCE_OUTCOMES] }).notNull(),
    recordedByUserId: text('recorded_by_user_id')
      .notNull()
      .references(() => user.id),
    recordedAt: integer('recorded_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('event_attendance_event_user_unique').on(
      table.eventId,
      table.userId,
    ),
    index('event_attendance_user_index').on(table.userId, table.recordedAt),
  ],
);

/**
 * The attendee pulse: one per member per event, updateable inside its window.
 *
 * `comment_language` is required alongside a comment and null without one. Member text is rendered
 * as authored and never translated, which is only possible if the language travelled with
 * it. The column is not a preference; it describes this string and nothing else.
 */
export const eventFeedback = sqliteTable(
  'event_feedback',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    stateCode: text('state_code').notNull(),
    cityCode: text('city_code').notNull(),
    valueRating: text('value_rating', {
      enum: [...FEEDBACK_RATINGS],
    }).notNull(),
    wouldReturn: integer('would_return', { mode: 'boolean' }).notNull(),
    comment: text('comment'),
    commentLanguage: text('comment_language', { enum: [...LOCALES] }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('event_feedback_event_user_unique').on(
      table.eventId,
      table.userId,
    ),
    index('event_feedback_event_index').on(table.eventId, table.createdAt),
  ],
);

/**
 * What a market has decided about one host.
 *
 * Unique per `(market_code, user_id)` and never global: a host restricted in one
 * market has not been restricted everywhere, and a global row would make that decision by accident
 * the first time the product opened a second market.
 */
export const hostTrust = sqliteTable(
  'host_trust',
  {
    id: text('id').primaryKey(),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    status: text('status', { enum: [...HOST_TRUST_STATUSES] })
      .notNull()
      .default('unreviewed'),
    reasonCode: text('reason_code', { enum: [...OPERATION_REASONS] }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('host_trust_market_user_unique').on(
      table.marketCode,
      table.userId,
    ),
    index('host_trust_status_index').on(table.marketCode, table.status),
  ],
);

/**
 * Append-only. What was changed, by whom, and under which verified identity.
 *
 * Nothing updates or deletes a row here; the mutable tables serve reads and this stream explains
 * how they got that way. `access_subject` carries the verified Cloudflare Access subject and is
 * required for admin actions, so an operator's product session and their Access identity
 * are recorded together rather than either standing alone.
 *
 * `metadata` holds stable before/after values and no member PII: names, contacts and free text stay
 * out of anything that is read for analysis.
 */
export const operationsAudit = sqliteTable(
  'operations_audit',
  {
    id: text('id').primaryKey(),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => user.id),
    accessSubject: text('access_subject'),
    action: text('action', { enum: [...AUDIT_ACTIONS] }).notNull(),
    targetType: text('target_type', { enum: [...AUDIT_TARGETS] }).notNull(),
    targetId: text('target_id').notNull(),
    reasonCode: text('reason_code', { enum: [...OPERATION_REASONS] }),
    metadata: text('metadata', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('operations_audit_market_time_index').on(
      table.marketCode,
      table.createdAt,
    ),
    index('operations_audit_target_index').on(table.targetType, table.targetId),
  ],
);

/** One weekly decision, with the evidence window it was taken from. */
export const operationsReviews = sqliteTable(
  'operations_reviews',
  {
    id: text('id').primaryKey(),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    stateCode: text('state_code'),
    cityCode: text('city_code'),
    evidenceWindowStart: integer('evidence_window_start', {
      mode: 'timestamp',
    }).notNull(),
    evidenceWindowEnd: integer('evidence_window_end', {
      mode: 'timestamp',
    }).notNull(),
    bottleneck: text('bottleneck', { enum: [...REVIEW_BOTTLENECKS] }).notNull(),
    intervention: text('intervention').notNull(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id),
    dueAt: integer('due_at', { mode: 'timestamp' }).notNull(),
    followUpResult: text('follow_up_result'),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('operations_reviews_market_window_index').on(
      table.marketCode,
      table.evidenceWindowStart,
    ),
  ],
);

/**
 * Monthly non-PII aggregates, which outlive the rows they were computed from.
 *
 * Closeouts, attendance and feedback retire after twenty-four months while these are kept
 * indefinitely, so the community's history survives its own retention policy. The unique key is the
 * whole identity of a measurement — market, scope, month, metric — so recomputing one overwrites
 * rather than accumulating a second answer for the same question.
 */
export const communityMetricSnapshots = sqliteTable(
  'community_metric_snapshots',
  {
    id: text('id').primaryKey(),
    marketCode: text('market_code')
      .notNull()
      .references(() => markets.code),
    scopeType: text('scope_type', { enum: [...OPERATIONS_SCOPES] }).notNull(),
    scopeCode: text('scope_code').notNull(),
    periodMonth: text('period_month').notNull(),
    metricKey: text('metric_key', { enum: [...METRIC_KEYS] }).notNull(),
    numerator: integer('numerator').notNull(),
    denominator: integer('denominator'),
    computedAt: integer('computed_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('community_metric_snapshots_identity_unique').on(
      table.marketCode,
      table.scopeType,
      table.scopeCode,
      table.periodMonth,
      table.metricKey,
    ),
  ],
);

export type EventCloseoutRow = typeof eventCloseouts.$inferSelect;
export type EventAttendanceRow = typeof eventAttendance.$inferSelect;
export type EventFeedbackRow = typeof eventFeedback.$inferSelect;
export type HostTrustRow = typeof hostTrust.$inferSelect;
export type OperationsAuditRow = typeof operationsAudit.$inferSelect;
export type OperationsReviewRow = typeof operationsReviews.$inferSelect;
export type CommunityMetricSnapshotRow =
  typeof communityMetricSnapshots.$inferSelect;
