ALTER TABLE `scheduled_notifications` ADD `fallback_of` text;--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_notifications_fallback_of_unique` ON `scheduled_notifications` (`fallback_of`);