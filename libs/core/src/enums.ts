import { z } from 'zod';

export const USER_ROLES = [
  'member',
  'host',
  'moderator',
  'admin',
  'sponsor_contact',
] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export const ACCOUNT_STATES = ['active', 'closing', 'deleted'] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];
export const accountStateSchema = z.enum(ACCOUNT_STATES);

export const MARKET_DIRECTIONS = ['rtl', 'ltr'] as const;
export type MarketDirection = (typeof MARKET_DIRECTIONS)[number];
export const marketDirectionSchema = z.enum(MARKET_DIRECTIONS);

export const MARKET_STATES = ['dark', 'open', 'active'] as const;
export type MarketState = (typeof MARKET_STATES)[number];
export const marketStateSchema = z.enum(MARKET_STATES);

export const EVENT_STATUSES = ['published', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const eventStatusSchema = z.enum(EVENT_STATUSES);

export const RSVP_STATUSES = ['going', 'waitlist', 'cancelled'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const rsvpStatusSchema = z.enum(RSVP_STATUSES);

export const ORDER_PURPOSES = [
  'sponsorship',
  'hosted_challenge_fee',
  'prize_payout',
  'host_fee',
] as const;
export type OrderPurpose = (typeof ORDER_PURPOSES)[number];
export const orderPurposeSchema = z.enum(ORDER_PURPOSES);

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const NOTIFICATION_DELIVERY_CHANNELS = [
  'sms',
  'email',
  'push',
  'telegram',
] as const;
export type NotificationDeliveryChannel =
  (typeof NOTIFICATION_DELIVERY_CHANNELS)[number];
export const notificationDeliveryChannelSchema = z.enum(
  NOTIFICATION_DELIVERY_CHANNELS,
);

export const NOTIFICATION_PREFERENCE_CHANNELS = ['push', 'email'] as const;
export type NotificationPreferenceChannel =
  (typeof NOTIFICATION_PREFERENCE_CHANNELS)[number];
export const notificationPreferenceChannelSchema = z.enum(
  NOTIFICATION_PREFERENCE_CHANNELS,
);

export const NOTIFICATION_FALLBACK_CHANNELS = ['email', 'sms'] as const;
export type NotificationFallbackChannel =
  (typeof NOTIFICATION_FALLBACK_CHANNELS)[number];
export const notificationFallbackChannelSchema = z.enum(
  NOTIFICATION_FALLBACK_CHANNELS,
);

export const NOTIFICATION_STATUSES = [
  'pending',
  'processing',
  'sent',
  'delivered',
  'failed',
  'cancelled',
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export const notificationStatusSchema = z.enum(NOTIFICATION_STATUSES);

export const TELEGRAM_GROUP_POST_KEYS = [
  'telegram_details',
  'telegram_reminder',
  'telegram_rescheduled',
  'telegram_relocated',
  'telegram_cancelled',
  'telegram_wrap_up',
] as const;
export type TelegramGroupPostKey = (typeof TELEGRAM_GROUP_POST_KEYS)[number];
export const TELEGRAM_TEMPLATE_KEYS = [
  ...TELEGRAM_GROUP_POST_KEYS,
  'telegram_disconnected',
  'telegram_member_removed',
] as const;
export type TelegramTemplateKey = (typeof TELEGRAM_TEMPLATE_KEYS)[number];

export const NOTIFICATION_TEMPLATE_KEYS = [
  'rsvp_confirmation',
  'reminder_72h',
  'reminder_24h',
  'event_cancelled',
  'event_rescheduled',
  'event_relocated',
  'rsvp_received',
  'rsvp_cancelled',
  'closeout_prompt',
  'event_did_not_happen',
  'feedback_invitation',
  ...TELEGRAM_TEMPLATE_KEYS,
] as const;
export type NotificationTemplateKey =
  (typeof NOTIFICATION_TEMPLATE_KEYS)[number];
export type PersonalTemplateKey = Exclude<
  NotificationTemplateKey,
  TelegramTemplateKey
>;
export const notificationTemplateKeySchema = z.enum(NOTIFICATION_TEMPLATE_KEYS);

export const RSVP_LIFECYCLE_TEMPLATE_KEYS = [
  'rsvp_confirmation',
  'reminder_72h',
  'reminder_24h',
  'event_cancelled',
  'event_rescheduled',
  'event_relocated',
] as const satisfies readonly NotificationTemplateKey[];

export const TELEGRAM_GROUP_STATUSES = ['pending', 'active', 'closed'] as const;
export type TelegramGroupStatus = (typeof TELEGRAM_GROUP_STATUSES)[number];
export const telegramGroupStatusSchema = z.enum(TELEGRAM_GROUP_STATUSES);

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];
export const pushPlatformSchema = z.enum(PUSH_PLATFORMS);

export const PUSH_SURFACES = ['pwa', 'rn'] as const;
export type PushSurface = (typeof PUSH_SURFACES)[number];
export const pushSurfaceSchema = z.enum(PUSH_SURFACES);

export const VENUE_KINDS = ['poi', 'address'] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];
export const venueKindSchema = z.enum(VENUE_KINDS);

export const PROFILE_ASSET_STATUSES = [
  'pending',
  'processing',
  'ready',
  'deleting',
] as const;
export type ProfileAssetStatus = (typeof PROFILE_ASSET_STATUSES)[number];
export const profileAssetStatusSchema = z.enum(PROFILE_ASSET_STATUSES);

export const PROFILE_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_MIME_TYPES)[number];
export const profilePhotoMimeSchema = z.enum(PROFILE_PHOTO_MIME_TYPES);

export const PROFILE_STAGES = ['idea', 'building', 'launched'] as const;
export type ProfileStage = (typeof PROFILE_STAGES)[number];
export const profileStageSchema = z.enum(PROFILE_STAGES);

export const CLOSEOUT_OUTCOMES = ['held', 'did_not_happen'] as const;
export type CloseoutOutcome = (typeof CLOSEOUT_OUTCOMES)[number];
export const closeoutOutcomeSchema = z.enum(CLOSEOUT_OUTCOMES);

export const ATTENDANCE_OUTCOMES = ['attended', 'no_show'] as const;
export type AttendanceOutcome = (typeof ATTENDANCE_OUTCOMES)[number];
export const attendanceOutcomeSchema = z.enum(ATTENDANCE_OUTCOMES);

export const FEEDBACK_RATINGS = ['valuable', 'okay', 'not_valuable'] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];
export const feedbackRatingSchema = z.enum(FEEDBACK_RATINGS);

export const HOST_TRUST_STATUSES = [
  'unreviewed',
  'verified',
  'restricted',
] as const;
export type HostTrustStatus = (typeof HOST_TRUST_STATUSES)[number];
export const hostTrustStatusSchema = z.enum(HOST_TRUST_STATUSES);

export const HOST_FRICTIONS = [
  'venue',
  'scheduling',
  'promotion',
  'attendance',
  'format',
  'safety',
  'other_structured',
] as const;
export type HostFriction = (typeof HOST_FRICTIONS)[number];
export const hostFrictionSchema = z.enum(HOST_FRICTIONS);

export const OPERATION_REASONS = [
  'host_request',
  'member_dispute',
  'data_entry_error',
  'safety',
  'policy',
  'delivery_recovery',
] as const;
export type OperationReason = (typeof OPERATION_REASONS)[number];
export const operationReasonSchema = z.enum(OPERATION_REASONS);

export const REVIEW_BOTTLENECKS = [
  'host_supply',
  'calendar_consistency',
  'venue_readiness',
  'discovery',
  'rsvp_conversion',
  'attendance',
  'event_quality',
  'return_behavior',
  'product_reliability',
] as const;
export type ReviewBottleneck = (typeof REVIEW_BOTTLENECKS)[number];
export const reviewBottleneckSchema = z.enum(REVIEW_BOTTLENECKS);

export const AUDIT_TARGETS = [
  'event',
  'user',
  'closeout',
  'attendance',
  'feedback',
  'host_trust',
  'operations_review',
] as const;
export type AuditTarget = (typeof AUDIT_TARGETS)[number];
export const auditTargetSchema = z.enum(AUDIT_TARGETS);

export const AUDIT_ACTIONS = [
  'closeout_submitted',
  'closeout_corrected',
  'attendance_recorded',
  'attendance_corrected',
  'host_trust_updated',
  'review_recorded',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export const auditActionSchema = z.enum(AUDIT_ACTIONS);

export const OPERATIONS_SCOPES = ['market', 'state', 'city'] as const;
export type OperationsScope = (typeof OPERATIONS_SCOPES)[number];
export const operationsScopeSchema = z.enum(OPERATIONS_SCOPES);

export const METRIC_KEYS = [
  'completed_events',
  'did_not_happen_events',
  'rsvp_to_attendance',
  'no_show_rate',
  'recurring_hosts',
  'host_retention_60d',
  'repeat_participation',
  'return_intent',
  'host_again_intent',
  'four_week_cover',
  'overdue_closeouts',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export const metricKeySchema = z.enum(METRIC_KEYS);
