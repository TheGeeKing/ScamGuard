ALTER TABLE `incidents` ADD `latency_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `false_positive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `incidents` ADD `reviewed_at` integer;