PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_account_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`event_updates` integer DEFAULT true NOT NULL,
	`event_updates_channels` integer DEFAULT 5 NOT NULL,
	`event_reminders` integer DEFAULT true NOT NULL,
	`event_reminders_channels` integer DEFAULT 5 NOT NULL,
	`host_rsvp_received` integer DEFAULT true NOT NULL,
	`host_rsvp_received_channels` integer DEFAULT 5 NOT NULL,
	`host_rsvp_cancelled` integer DEFAULT true NOT NULL,
	`host_rsvp_cancelled_channels` integer DEFAULT 5 NOT NULL,
	`follow_up_prompts` integer DEFAULT true NOT NULL,
	`follow_up_prompts_channels` integer DEFAULT 4 NOT NULL,
	`push_enabled` integer DEFAULT false NOT NULL,
	`sms_fallback_enabled` integer DEFAULT false NOT NULL,
	`sms_consent_at` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_account_preferences`("user_id", "event_updates", "event_updates_channels", "event_reminders", "event_reminders_channels", "host_rsvp_received", "host_rsvp_received_channels", "host_rsvp_cancelled", "host_rsvp_cancelled_channels", "follow_up_prompts", "follow_up_prompts_channels", "push_enabled", "sms_fallback_enabled", "sms_consent_at", "revision", "created_at", "updated_at") SELECT "user_id", "event_updates", "event_updates_channels", "event_reminders", "event_reminders_channels", "host_rsvp_received", "host_rsvp_received_channels", "host_rsvp_cancelled", "host_rsvp_cancelled_channels", "follow_up_prompts", "follow_up_prompts_channels", "push_enabled", "sms_fallback_enabled", "sms_consent_at", "revision", "created_at", "updated_at" FROM `account_preferences`;--> statement-breakpoint
DROP TABLE `account_preferences`;--> statement-breakpoint
ALTER TABLE `__new_account_preferences` RENAME TO `account_preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- Existing rows were materialised with the old default and would stay opted out, because the
-- table above only changes what a NEW row gets. Only rows still holding the exact original pair
-- are moved: anyone who turned the prompt on keeps their own channel mask, and nobody who chose
-- a setting has it overwritten. No feedback invitation has ever been delivered -- every one
-- resolved `follow_up_prompts_off` -- so no member has had cause to opt out of something they
-- have never received.
UPDATE `account_preferences`
SET `follow_up_prompts` = 1, `follow_up_prompts_channels` = 4
WHERE `follow_up_prompts` = 0 AND `follow_up_prompts_channels` = 0;
