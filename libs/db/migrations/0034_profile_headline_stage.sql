ALTER TABLE `member_profiles` ADD `headline` text;--> statement-breakpoint
ALTER TABLE `member_profiles` ADD `stage` text;--> statement-breakpoint
ALTER TABLE `member_profiles` ADD `publish_headline` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `member_profiles` ADD `publish_stage` integer DEFAULT false NOT NULL;