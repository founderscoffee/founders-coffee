CREATE TABLE `city_waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`market_code` text NOT NULL,
	`city_code` text NOT NULL,
	`locale` text NOT NULL,
	`notified_at` integer DEFAULT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `city_waitlist_email_city_unique` ON `city_waitlist` (`email`,`city_code`);--> statement-breakpoint
CREATE INDEX `city_waitlist_city_code_index` ON `city_waitlist` (`city_code`);
