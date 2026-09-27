CREATE TABLE `city_waitlist_launches` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`market_code` text NOT NULL,
	`city_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`cancelled_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `city_waitlist_launch_event_unique` ON `city_waitlist_launches` (`event_id`);--> statement-breakpoint
CREATE INDEX `city_waitlist_launch_pending_index` ON `city_waitlist_launches` (`created_at`) WHERE status = 'pending';--> statement-breakpoint
CREATE TABLE `city_waitlist_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`launch_id` text NOT NULL,
	`waitlist_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer DEFAULT (unixepoch()) NOT NULL,
	`claimed_at` integer,
	`dispatch_started_at` integer,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`launch_id`) REFERENCES `city_waitlist_launches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`waitlist_id`) REFERENCES `city_waitlist`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `city_waitlist_notification_live_unique` ON `city_waitlist_notifications` (`waitlist_id`) WHERE status IN ('pending', 'processing', 'sent');--> statement-breakpoint
CREATE UNIQUE INDEX `city_waitlist_notification_round_unique` ON `city_waitlist_notifications` (`launch_id`,`waitlist_id`);--> statement-breakpoint
CREATE INDEX `city_waitlist_notification_due_index` ON `city_waitlist_notifications` (`launch_id`,`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `city_waitlist_notification_claimed_index` ON `city_waitlist_notifications` (`launch_id`,`claimed_at`) WHERE status = 'processing';--> statement-breakpoint
DROP INDEX `city_waitlist_email_city_unique`;--> statement-breakpoint
DROP INDEX `city_waitlist_city_code_index`;--> statement-breakpoint
CREATE INDEX `city_waitlist_notified_index` ON `city_waitlist` (`notified_at`) WHERE notified_at IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `city_waitlist_email_city_unique` ON `city_waitlist` (`email`,`market_code`,`city_code`);--> statement-breakpoint
CREATE INDEX `city_waitlist_city_code_index` ON `city_waitlist` (`market_code`,`city_code`);