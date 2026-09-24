CREATE TABLE `event_telegram_groups` (
	`event_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`chat_id` integer,
	`chat_title` text,
	`pinned_message_id` integer,
	`connect_token_hash` text,
	`connect_token_expires_at` integer,
	`connected_at` integer,
	`closed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_telegram_groups_connect_token_unique` ON `event_telegram_groups` (`connect_token_hash`);--> statement-breakpoint
CREATE INDEX `event_telegram_groups_chat_id_index` ON `event_telegram_groups` (`chat_id`);--> statement-breakpoint
CREATE TABLE `event_telegram_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invite_link` text NOT NULL,
	`telegram_user_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_telegram_invites_event_user_unique` ON `event_telegram_invites` (`event_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_telegram_invites_link_unique` ON `event_telegram_invites` (`invite_link`);--> statement-breakpoint
CREATE INDEX `event_telegram_invites_user_id_index` ON `event_telegram_invites` (`user_id`);