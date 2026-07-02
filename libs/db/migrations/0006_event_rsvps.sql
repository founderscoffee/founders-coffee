CREATE TABLE `event_rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL DEFAULT 'going',
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_rsvps_event_id_user_id_unique` ON `event_rsvps` (`event_id`, `user_id`);--> statement-breakpoint
CREATE INDEX `event_rsvps_user_id_index` ON `event_rsvps` (`user_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `rsvps` integer NOT NULL DEFAULT 0;