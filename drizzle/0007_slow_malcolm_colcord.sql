CREATE TABLE `perceptual_fingerprints` (
	`id` text PRIMARY KEY NOT NULL,
	`source_sha256` text NOT NULL,
	`version` text NOT NULL,
	`classification` text NOT NULL,
	`guild_id` text,
	`pdq` text NOT NULL,
	`quality` integer NOT NULL,
	`crops` text NOT NULL
);
