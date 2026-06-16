CREATE TABLE `residents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`birth_date` text,
	`gender` text,
	`contact_number` text,
	`purok` text NOT NULL,
	`household_id` text,
	`is_head_of_household` integer DEFAULT false,
	`relationship_to_head` text,
	`is_pwd` integer DEFAULT false,
	`pwd_type` text,
	`is_senior_citizen` integer DEFAULT false,
	`is_voter` integer DEFAULT false,
	`is_single_parent` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
