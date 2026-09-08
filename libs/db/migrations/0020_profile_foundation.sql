CREATE TABLE `account_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`event_updates` integer DEFAULT true NOT NULL,
	`event_reminders` integer DEFAULT true NOT NULL,
	`host_updates` integer DEFAULT true NOT NULL,
	`follow_up_prompts` integer DEFAULT false NOT NULL,
	`push_enabled` integer DEFAULT false NOT NULL,
	`sms_fallback_enabled` integer DEFAULT false NOT NULL,
	`sms_consent_at` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`introduction` text,
	`introduction_locale` text,
	`community_role` text,
	`interests` text DEFAULT '[]' NOT NULL,
	`spoken_languages` text DEFAULT '[]' NOT NULL,
	`professional_link` text,
	`photo_asset_id` text,
	`publish_photo` integer DEFAULT false NOT NULL,
	`publish_introduction` integer DEFAULT false NOT NULL,
	`publish_community_role` integer DEFAULT false NOT NULL,
	`publish_interests` integer DEFAULT false NOT NULL,
	`publish_spoken_languages` integer DEFAULT false NOT NULL,
	`publish_professional_link` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_asset_id`,`user_id`) REFERENCES `profile_assets`(`id`,`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profile_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mime_type` text,
	`byte_size` integer,
	`width` integer,
	`height` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_assets_object_key_unique` ON `profile_assets` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_asset_id_user_unique` ON `profile_assets` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `profile_assets_expiry_index` ON `profile_assets` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `push_session_links` (
	`subscription_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`,`user_id`) REFERENCES `push_subscriptions`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`,`user_id`) REFERENCES `session`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_session_links_session_index` ON `push_session_links` (`session_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `account_state` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscription_id_user_unique` ON `push_subscriptions` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_id_user_unique` ON `session` (`id`,`user_id`);--> statement-breakpoint
INSERT INTO `member_profiles` (`user_id`) SELECT `id` FROM `user`;--> statement-breakpoint
INSERT INTO `account_preferences` (`user_id`) SELECT `id` FROM `user`;
