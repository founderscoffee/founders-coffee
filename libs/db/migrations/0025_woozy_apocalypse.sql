CREATE TABLE `community_metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`market_code` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_code` text NOT NULL,
	`period_month` text NOT NULL,
	`metric_key` text NOT NULL,
	`numerator` integer NOT NULL,
	`denominator` integer,
	`computed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_metric_snapshots_identity_unique` ON `community_metric_snapshots` (`market_code`,`scope_type`,`scope_code`,`period_month`,`metric_key`);--> statement-breakpoint
CREATE TABLE `event_attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`market_code` text NOT NULL,
	`state_code` text NOT NULL,
	`city_code` text NOT NULL,
	`outcome` text NOT NULL,
	`recorded_by_user_id` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_attendance_event_user_unique` ON `event_attendance` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_attendance_user_index` ON `event_attendance` (`user_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `event_closeouts` (
	`event_id` text PRIMARY KEY NOT NULL,
	`market_code` text NOT NULL,
	`state_code` text NOT NULL,
	`city_code` text NOT NULL,
	`outcome` text NOT NULL,
	`walk_in_count` integer DEFAULT 0 NOT NULL,
	`would_host_again` integer,
	`host_friction` text DEFAULT '[]' NOT NULL,
	`private_note` text,
	`submitted_by_user_id` text NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by_user_id` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_closeouts_market_outcome_index` ON `event_closeouts` (`market_code`,`outcome`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `event_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`market_code` text NOT NULL,
	`state_code` text NOT NULL,
	`city_code` text NOT NULL,
	`value_rating` text NOT NULL,
	`would_return` integer NOT NULL,
	`comment` text,
	`comment_language` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_feedback_event_user_unique` ON `event_feedback` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_feedback_event_index` ON `event_feedback` (`event_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `host_trust` (
	`id` text PRIMARY KEY NOT NULL,
	`market_code` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`reason_code` text,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `host_trust_market_user_unique` ON `host_trust` (`market_code`,`user_id`);--> statement-breakpoint
CREATE INDEX `host_trust_status_index` ON `host_trust` (`market_code`,`status`);--> statement-breakpoint
CREATE TABLE `operations_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`market_code` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`access_subject` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason_code` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `operations_audit_market_time_index` ON `operations_audit` (`market_code`,`created_at`);--> statement-breakpoint
CREATE INDEX `operations_audit_target_index` ON `operations_audit` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `operations_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`market_code` text NOT NULL,
	`state_code` text,
	`city_code` text,
	`evidence_window_start` integer NOT NULL,
	`evidence_window_end` integer NOT NULL,
	`bottleneck` text NOT NULL,
	`intervention` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`follow_up_result` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `operations_reviews_market_window_index` ON `operations_reviews` (`market_code`,`evidence_window_start`);