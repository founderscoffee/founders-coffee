ALTER TABLE `account_preferences` ADD `host_rsvp_received` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `account_preferences` ADD `host_rsvp_received_channels` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_preferences` ADD `host_rsvp_cancelled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `account_preferences` ADD `host_rsvp_cancelled_channels` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_preferences` DROP COLUMN `host_updates`;--> statement-breakpoint
ALTER TABLE `account_preferences` DROP COLUMN `host_updates_channels`;