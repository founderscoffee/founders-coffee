UPDATE markets
SET state = 'active'
WHERE code IN ('DZ', 'EG', 'SA');--> statement-breakpoint
DELETE FROM markets
WHERE code IN ('MA', 'AE');
