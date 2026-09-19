ALTER TABLE `markets` ADD `name_fr` text;--> statement-breakpoint
UPDATE markets SET name_fr = 'Algérie' WHERE code = 'DZ' AND name_fr IS NULL;--> statement-breakpoint
UPDATE markets SET name_fr = 'Égypte' WHERE code = 'EG' AND name_fr IS NULL;--> statement-breakpoint
UPDATE markets SET name_fr = 'Arabie saoudite' WHERE code = 'SA' AND name_fr IS NULL;
