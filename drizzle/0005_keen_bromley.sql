ALTER TABLE `incidents` ADD `is_webhook` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `action_outcomes` text DEFAULT '[]' NOT NULL;
