CREATE TABLE `moderator_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`incident_message_id` text NOT NULL,
	`action` text NOT NULL,
	`moderator_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`reverses_review_id` text,
	`effects` text NOT NULL
);
