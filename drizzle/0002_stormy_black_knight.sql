CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`image_evidence` text NOT NULL,
	`signals` text NOT NULL,
	`score` integer NOT NULL,
	`intention` text NOT NULL,
	`moderation_mode` text NOT NULL,
	`intended_actions` text NOT NULL
);
