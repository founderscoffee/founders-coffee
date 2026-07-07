PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_city_waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`market_code` text NOT NULL,
	`city_code` text NOT NULL,
	`locale` text NOT NULL,
	`notified_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_city_waitlist`("id", "email", "market_code", "city_code", "locale", "notified_at", "created_at") SELECT "id", "email", "market_code", "city_code", "locale", "notified_at", "created_at" FROM `city_waitlist`;--> statement-breakpoint
DROP TABLE `city_waitlist`;--> statement-breakpoint
ALTER TABLE `__new_city_waitlist` RENAME TO `city_waitlist`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `city_waitlist_email_city_unique` ON `city_waitlist` (`email`,`city_code`);--> statement-breakpoint
CREATE INDEX `city_waitlist_city_code_index` ON `city_waitlist` (`city_code`);--> statement-breakpoint
ALTER TABLE `markets` ADD `name_ar` text;--> statement-breakpoint
CREATE UNIQUE INDEX `event_rsvps_event_id_user_id_unique` ON `event_rsvps` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_rsvps_user_id_index` ON `event_rsvps` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_notifications_pending` ON `scheduled_notifications` (`send_at`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `scheduled_notifications_event_id_index` ON `scheduled_notifications` (`event_id`);--> statement-breakpoint
CREATE INDEX `scheduled_notifications_user_id_index` ON `scheduled_notifications` (`user_id`);