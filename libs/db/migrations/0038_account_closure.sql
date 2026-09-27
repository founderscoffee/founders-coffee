ALTER TABLE `user` ADD `closed_at` integer;--> statement-breakpoint
CREATE INDEX `user_closing_index` ON `user` (`closed_at`) WHERE account_state = 'closing';