ALTER TABLE `events` ADD `languages` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE events SET languages = json_array(language) WHERE languages = '[]';
