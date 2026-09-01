ALTER TABLE `guilds` ADD `moderation_mode` text;--> statement-breakpoint
ALTER TABLE `guilds` ADD `suspicious_score` integer;--> statement-breakpoint
ALTER TABLE `guilds` ADD `delete_score` integer;--> statement-breakpoint
ALTER TABLE `guilds` ADD `timeout_score` integer;--> statement-breakpoint
ALTER TABLE `guilds` ADD `timeout_minutes` integer;--> statement-breakpoint
ALTER TABLE `guilds` ADD `incident_retention_days` integer;--> statement-breakpoint
ALTER TABLE `guilds` ADD `moderation_log_channel_id` text;--> statement-breakpoint
ALTER TABLE `guilds` ADD `ignored_channel_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `guilds` ADD `trusted_role_ids` text DEFAULT '[]' NOT NULL;