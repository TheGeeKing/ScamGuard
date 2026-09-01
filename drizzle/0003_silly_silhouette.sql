CREATE TABLE `fingerprints` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`sha256` text NOT NULL,
	`classification` text NOT NULL,
	`source` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
