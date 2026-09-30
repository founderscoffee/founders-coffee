import { z } from 'zod';

export const CHAT_OPEN_DAYS_AFTER_MEETUP = 7;
export const CHAT_KEPT_DAYS_AFTER_MEETUP = 90;
export const CHAT_REPORT_KEPT_MONTHS = 24;

export const CHAT_CHANNEL_KINDS = ['meetup'] as const;
export type ChatChannelKind = (typeof CHAT_CHANNEL_KINDS)[number];
export const chatChannelKindSchema = z.enum(CHAT_CHANNEL_KINDS);

export const CHAT_MESSAGE_KINDS = ['text', 'system'] as const;
export type ChatMessageKind = (typeof CHAT_MESSAGE_KINDS)[number];
export const chatMessageKindSchema = z.enum(CHAT_MESSAGE_KINDS);

export const CHAT_SYSTEM_KEYS = [
  'rescheduled',
  'relocated',
  'cancelled',
] as const;
export type ChatSystemKey = (typeof CHAT_SYSTEM_KEYS)[number];
export const chatSystemKeySchema = z.enum(CHAT_SYSTEM_KEYS);

export const CHAT_MESSAGE_REMOVALS = ['author', 'host', 'moderator'] as const;
export type ChatMessageRemoval = (typeof CHAT_MESSAGE_REMOVALS)[number];
export const chatMessageRemovalSchema = z.enum(CHAT_MESSAGE_REMOVALS);

export const CHAT_REPORT_REASONS = ['spam', 'harassment', 'other'] as const;
export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];
export const chatReportReasonSchema = z.enum(CHAT_REPORT_REASONS);

export const CHAT_REPORT_STATUSES = ['open', 'removed', 'dismissed'] as const;
export type ChatReportStatus = (typeof CHAT_REPORT_STATUSES)[number];
export const chatReportStatusSchema = z.enum(CHAT_REPORT_STATUSES);

export const CHAT_SEND_OUTCOMES = [
  'sent',
  'already_sent',
  'not_member',
  'read_only',
  'chat_missing',
] as const;
export type ChatSendOutcome = (typeof CHAT_SEND_OUTCOMES)[number];
export const chatSendOutcomeSchema = z.enum(CHAT_SEND_OUTCOMES);

export const CHAT_REPORT_OUTCOMES = [
  'reported',
  'already_reported',
  'refused',
] as const;
export type ChatReportOutcome = (typeof CHAT_REPORT_OUTCOMES)[number];
export const chatReportOutcomeSchema = z.enum(CHAT_REPORT_OUTCOMES);
