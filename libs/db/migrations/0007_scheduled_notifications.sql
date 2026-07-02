CREATE TABLE `scheduled_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL DEFAULT 'sms',
	`status` text NOT NULL DEFAULT 'pending',
	`template_key` text NOT NULL,
	`payload` text NOT NULL,
	`send_at` integer NOT NULL,
	`attempts` integer NOT NULL DEFAULT 0,
	`last_error` text,
	`fallback_channel` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_notifications_pending` ON `scheduled_notifications` (`send_at`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `scheduled_notifications_event_id_index` ON `scheduled_notifications` (`event_id`);--> statement-breakpoint
CREATE INDEX `scheduled_notifications_user_id_index` ON `scheduled_notifications` (`user_id`);