CREATE TABLE `trusted_contacts` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`relationship` text DEFAULT 'family' NOT NULL,
	`device_contact_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
