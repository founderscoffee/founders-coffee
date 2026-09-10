PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `__pf03_account` AS SELECT * FROM `account`;
--> statement-breakpoint
CREATE TABLE `__pf03_session` AS SELECT * FROM `session`;
--> statement-breakpoint
CREATE TABLE `__pf03_events` AS SELECT * FROM `events`;
--> statement-breakpoint
CREATE TABLE `__pf03_event_rsvps` AS SELECT * FROM `event_rsvps`;
--> statement-breakpoint
CREATE TABLE `__pf03_scheduled_notifications` AS SELECT * FROM `scheduled_notifications`;
--> statement-breakpoint
CREATE TABLE `__pf03_push_subscriptions` AS SELECT * FROM `push_subscriptions`;
--> statement-breakpoint
CREATE TABLE `__pf03_account_preferences` AS SELECT * FROM `account_preferences`;
--> statement-breakpoint
CREATE TABLE `__pf03_profile_assets` AS SELECT * FROM `profile_assets`;
--> statement-breakpoint
CREATE TABLE `__pf03_member_profiles` AS SELECT * FROM `member_profiles`;
--> statement-breakpoint
CREATE TABLE `__pf03_push_session_links` AS SELECT * FROM `push_session_links`;
--> statement-breakpoint
CREATE TABLE `__new_user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `email_verified` integer DEFAULT false NOT NULL,
  `image` text,
  `role` text DEFAULT 'member' NOT NULL,
  `account_state` text DEFAULT 'active' NOT NULL,
  `banned` integer DEFAULT false,
  `ban_reason` text,
  `ban_expires` integer,
  `phone_number` text,
  `phone_number_verified` integer DEFAULT false NOT NULL,
  `locale_pref` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user` SELECT `id`, `name`, `email`, `email_verified`, `image`, `role`, `account_state`, `banned`, `ban_reason`, `ban_expires`, `phone_number`, `phone_number_verified`, `locale_pref`, `created_at`, `updated_at` FROM `user`;
--> statement-breakpoint
DROP TABLE `user`;
--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);
--> statement-breakpoint
INSERT INTO `account` SELECT * FROM `__pf03_account`;
--> statement-breakpoint
INSERT INTO `session` SELECT * FROM `__pf03_session`;
--> statement-breakpoint
INSERT INTO `events` SELECT * FROM `__pf03_events`;
--> statement-breakpoint
INSERT INTO `event_rsvps` SELECT * FROM `__pf03_event_rsvps`;
--> statement-breakpoint
INSERT INTO `scheduled_notifications` SELECT * FROM `__pf03_scheduled_notifications`;
--> statement-breakpoint
INSERT INTO `push_subscriptions` SELECT * FROM `__pf03_push_subscriptions`;
--> statement-breakpoint
INSERT INTO `account_preferences` SELECT * FROM `__pf03_account_preferences`;
--> statement-breakpoint
INSERT INTO `profile_assets` SELECT * FROM `__pf03_profile_assets`;
--> statement-breakpoint
INSERT INTO `member_profiles` SELECT * FROM `__pf03_member_profiles`;
--> statement-breakpoint
INSERT INTO `push_session_links` SELECT * FROM `__pf03_push_session_links`;
--> statement-breakpoint
DROP TABLE `__pf03_account`;
--> statement-breakpoint
DROP TABLE `__pf03_session`;
--> statement-breakpoint
DROP TABLE `__pf03_events`;
--> statement-breakpoint
DROP TABLE `__pf03_event_rsvps`;
--> statement-breakpoint
DROP TABLE `__pf03_scheduled_notifications`;
--> statement-breakpoint
DROP TABLE `__pf03_push_subscriptions`;
--> statement-breakpoint
DROP TABLE `__pf03_account_preferences`;
--> statement-breakpoint
DROP TABLE `__pf03_profile_assets`;
--> statement-breakpoint
DROP TABLE `__pf03_member_profiles`;
--> statement-breakpoint
DROP TABLE `__pf03_push_session_links`;
--> statement-breakpoint
CREATE TABLE `__pf03_fk_check` (`violations` integer NOT NULL CHECK (`violations` = 0));
--> statement-breakpoint
INSERT INTO `__pf03_fk_check` SELECT count(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE `__pf03_fk_check`;
--> statement-breakpoint
PRAGMA defer_foreign_keys = OFF;
