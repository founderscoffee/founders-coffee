DROP TABLE `event_telegram_groups`;--> statement-breakpoint
DROP TABLE `event_telegram_invites`;--> statement-breakpoint
DELETE FROM `scheduled_notifications` WHERE `channel` = 'telegram';
