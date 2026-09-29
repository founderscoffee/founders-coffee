CREATE TABLE `chat_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'meetup' NOT NULL,
	`event_id` text NOT NULL,
	`market_code` text NOT NULL,
	`read_only_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_channels_event_id_unique` ON `chat_channels` (`event_id`);--> statement-breakpoint
CREATE INDEX `chat_channels_expires_at_index` ON `chat_channels` (`expires_at`);--> statement-breakpoint
CREATE TABLE `chat_members` (
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_at` integer,
	`muted` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`channel_id`, `user_id`),
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_members_user_id_index` ON `chat_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`author_id` text,
	`kind` text DEFAULT 'text' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`system_key` text,
	`system_params` text,
	`client_id` text,
	`created_at` integer NOT NULL,
	`removed_at` integer,
	`removed_by` text,
	`removal` text,
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`removed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `chat_messages_channel_created_index` ON `chat_messages` (`channel_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_channel_author_client_unique` ON `chat_messages` (`channel_id`,`author_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `chat_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`market_code` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_reports_message_reporter_unique` ON `chat_reports` (`message_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `chat_reports_market_status_index` ON `chat_reports` (`market_code`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_reports_created_at_index` ON `chat_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `chat_reports_reporter_id_index` ON `chat_reports` (`reporter_id`);--> statement-breakpoint
INSERT INTO `chat_channels` (`id`, `kind`, `event_id`, `market_code`, `read_only_at`, `expires_at`, `created_at`, `updated_at`)
SELECT
	'chn_' || lower(hex(randomblob(16))),
	'meetup',
	`id`,
	`market_code`,
	(CASE WHEN `status` = 'cancelled' THEN coalesce(`cancelled_at`, `updated_at`) ELSE coalesce(`ends_at`, `starts_at` + 7200) END)
		+ (CASE WHEN `status` = 'cancelled' THEN 0 ELSE 604800 END),
	(CASE WHEN `status` = 'cancelled' THEN coalesce(`cancelled_at`, `updated_at`) ELSE coalesce(`ends_at`, `starts_at` + 7200) END) + 7776000,
	unixepoch(),
	unixepoch()
FROM `events`
WHERE (CASE WHEN `status` = 'cancelled' THEN coalesce(`cancelled_at`, `updated_at`) ELSE coalesce(`ends_at`, `starts_at` + 7200) END) + 7776000 > unixepoch();
