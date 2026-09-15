ALTER TABLE `account_preferences` ADD `event_updates_channels` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_preferences` ADD `event_reminders_channels` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_preferences` ADD `host_updates_channels` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_preferences` ADD `follow_up_prompts_channels` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `account_preferences`
SET
  `event_updates_channels` = CASE WHEN `event_updates` = 1 THEN 5 ELSE 0 END,
  `event_reminders_channels` = CASE WHEN `event_reminders` = 1 THEN 5 ELSE 0 END,
  `host_updates_channels` = CASE WHEN `host_updates` = 1 THEN 5 ELSE 0 END,
  `follow_up_prompts_channels` = CASE WHEN `follow_up_prompts` = 1 THEN 5 ELSE 0 END;
