CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`institution` text,
	`type` text NOT NULL,
	`current_balance_cents` integer DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`related_entity` text,
	`actions` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_for` integer,
	`sent_at` integer,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alert_status_idx` ON `alerts` (`status`);--> statement-breakpoint
CREATE INDEX `alert_type_idx` ON `alerts` (`type`);--> statement-breakpoint
CREATE INDEX `alert_scheduled_idx` ON `alerts` (`scheduled_for`);--> statement-breakpoint
CREATE TABLE `cash_runway` (
	`id` text PRIMARY KEY NOT NULL,
	`current_balance_cents` integer NOT NULL,
	`calculated_at` integer NOT NULL,
	`days_until_zero` integer,
	`zero_date` text,
	`daily_burn_rate_cents` integer NOT NULL,
	`weekly_burn_rate_cents` integer NOT NULL,
	`upcoming_bills_cents` integer NOT NULL,
	`upcoming_bills_count` integer NOT NULL,
	`safe_to_spend_today_cents` integer NOT NULL,
	`safe_to_spend_week_cents` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runway_calculated_idx` ON `cash_runway` (`calculated_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`emoji` text,
	`color` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `category_user_idx` ON `categories` (`user_id`);--> statement-breakpoint
CREATE TABLE `category_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`pattern_type` text NOT NULL,
	`pattern_value` text NOT NULL,
	`match_count` integer DEFAULT 0 NOT NULL,
	`confidence` real DEFAULT 0.5 NOT NULL,
	`learned_from` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pattern_category_idx` ON `category_patterns` (`category_id`);--> statement-breakpoint
CREATE INDEX `pattern_type_value_idx` ON `category_patterns` (`pattern_type`,`pattern_value`);--> statement-breakpoint
CREATE TABLE `daily_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`forecast_date` text NOT NULL,
	`predicted_balance_cents` integer NOT NULL,
	`confidence_interval_cents` integer,
	`expected_income_cents` integer DEFAULT 0,
	`expected_expenses_cents` integer DEFAULT 0,
	`expected_bills_cents` integer DEFAULT 0,
	`cashflow_risk` text DEFAULT 'safe' NOT NULL,
	`weather_emoji` text,
	`weather_summary` text,
	`recommendations` text,
	`generated_at` integer NOT NULL,
	`actual_balance_cents` integer
);
--> statement-breakpoint
CREATE INDEX `forecast_date_idx` ON `daily_forecasts` (`forecast_date`);--> statement-breakpoint
CREATE TABLE `daily_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`summary_date` text NOT NULL,
	`weather_emoji` text NOT NULL,
	`weather_headline` text NOT NULL,
	`current_balance_cents` integer NOT NULL,
	`cash_runway_days` integer,
	`safe_to_spend_cents` integer,
	`yesterday_spent_cents` integer,
	`yesterday_earned_cents` integer,
	`bills_due_count` integer DEFAULT 0,
	`bills_due_amount_cents` integer DEFAULT 0,
	`summary_text` text NOT NULL,
	`coaching_tips` text,
	`warnings` text,
	`opportunities` text,
	`generated_at` integer NOT NULL,
	`sent_at` integer,
	`opened_at` integer
);
--> statement-breakpoint
CREATE INDEX `summary_date_idx` ON `daily_summaries` (`summary_date`);--> statement-breakpoint
CREATE TABLE `debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`transaction_id` text,
	`amount_cents` integer NOT NULL,
	`principal_cents` integer,
	`interest_cents` integer,
	`payment_date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `debt_payment_debt_idx` ON `debt_payments` (`debt_id`);--> statement-breakpoint
CREATE INDEX `debt_payment_date_idx` ON `debt_payments` (`payment_date`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`account_id` text,
	`original_balance_cents` integer NOT NULL,
	`current_balance_cents` integer NOT NULL,
	`apr_percent` real NOT NULL,
	`minimum_payment_cents` integer,
	`term_months` integer,
	`start_date` text,
	`due_day` integer,
	`next_due_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`death_date` text,
	`total_interest_projected_cents` integer,
	`danger_score` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `debt_status_idx` ON `debts` (`status`);--> statement-breakpoint
CREATE INDEX `debt_danger_idx` ON `debts` (`danger_score`);--> statement-breakpoint
CREATE TABLE `decision_state` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`decision_version` text NOT NULL,
	`risk_level` text NOT NULL,
	`primary_command_type` text NOT NULL,
	`primary_command_text` text NOT NULL,
	`primary_command_amount_cents` integer,
	`primary_command_target` text,
	`primary_command_date` text,
	`warning_1` text,
	`warning_2` text,
	`next_action_text` text NOT NULL,
	`next_action_url` text NOT NULL,
	`decision_basis_json` text,
	`computed_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`acknowledged_at` integer
);
--> statement-breakpoint
CREATE INDEX `decision_state_user_idx` ON `decision_state` (`user_id`);--> statement-breakpoint
CREATE INDEX `decision_state_expires_idx` ON `decision_state` (`expires_at`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size_bytes` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_type` text NOT NULL,
	`extracted_data` text,
	`extraction_confidence` real,
	`processed_at` integer,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `document_status_idx` ON `documents` (`status`);--> statement-breakpoint
CREATE INDEX `document_source_idx` ON `documents` (`source_type`);--> statement-breakpoint
CREATE TABLE `email_verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_verification_token_idx` ON `email_verification_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `email_verification_user_idx` ON `email_verification_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `envelopes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`month` text NOT NULL,
	`budget_cents` integer NOT NULL,
	`spent_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `envelope_user_idx` ON `envelopes` (`user_id`);--> statement-breakpoint
CREATE INDEX `envelope_month_category_idx` ON `envelopes` (`month`,`category_id`);--> statement-breakpoint
CREATE TABLE `file_imported_items` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`parsed_item_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `imported_item_file_idx` ON `file_imported_items` (`file_id`);--> statement-breakpoint
CREATE INDEX `imported_item_transaction_idx` ON `file_imported_items` (`transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `imported_item_unique_idx` ON `file_imported_items` (`file_id`,`parsed_item_id`);--> statement-breakpoint
CREATE TABLE `file_parsed_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`parser_version` text NOT NULL,
	`document_type` text NOT NULL,
	`summary_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parsed_summary_file_idx` ON `file_parsed_summaries` (`file_id`);--> statement-breakpoint
CREATE INDEX `parsed_summary_version_idx` ON `file_parsed_summaries` (`parser_version`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`emoji` text,
	`target_amount_cents` integer NOT NULL,
	`current_amount_cents` integer DEFAULT 0 NOT NULL,
	`target_date` text,
	`start_date` text NOT NULL,
	`goal_type` text NOT NULL,
	`linked_debt_id` text,
	`linked_account_id` text,
	`progress_percent` real DEFAULT 0 NOT NULL,
	`on_track` integer DEFAULT true,
	`projected_completion_date` text,
	`recommended_monthly_cents` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `goal_user_idx` ON `goals` (`user_id`);--> statement-breakpoint
CREATE INDEX `goal_status_idx` ON `goals` (`status`);--> statement-breakpoint
CREATE INDEX `goal_type_idx` ON `goals` (`goal_type`);--> statement-breakpoint
CREATE TABLE `household_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`email` text,
	`token` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_invite_token_idx` ON `household_invites` (`token`);--> statement-breakpoint
CREATE INDEX `household_invite_household_idx` ON `household_invites` (`household_id`);--> statement-breakpoint
CREATE INDEX `household_invite_email_idx` ON `household_invites` (`email`);--> statement-breakpoint
CREATE TABLE `household_members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`invited_at` integer NOT NULL,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE INDEX `household_member_household_idx` ON `household_members` (`household_id`);--> statement-breakpoint
CREATE INDEX `household_member_user_idx` ON `household_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `household_member_unique_idx` ON `household_members` (`household_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_code` text,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_invite_code_idx` ON `households` (`invite_code`);--> statement-breakpoint
CREATE INDEX `household_created_by_idx` ON `households` (`created_by_id`);--> statement-breakpoint
CREATE TABLE `interview_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`current_step` text DEFAULT 'cash' NOT NULL,
	`conversation_history` text,
	`extracted_data` text,
	`insight_flags` text,
	`uploaded_file_ids` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`last_activity_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_session_user_idx` ON `interview_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `interview_session_status_idx` ON `interview_sessions` (`status`);--> statement-breakpoint
CREATE TABLE `monthly_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`total_income_cents` integer DEFAULT 0 NOT NULL,
	`income_variance_percent` real,
	`total_spending_cents` integer DEFAULT 0 NOT NULL,
	`spending_variance_percent` real,
	`net_savings_cents` integer DEFAULT 0 NOT NULL,
	`savings_rate_percent` real,
	`category_totals` text,
	`danger_days_count` integer DEFAULT 0,
	`overspend_days_count` integer DEFAULT 0,
	`ai_insights` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snapshot_month_idx` ON `monthly_snapshots` (`month`);--> statement-breakpoint
CREATE TABLE `oauth_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_user_idx` ON `oauth_connections` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_provider_idx` ON `oauth_connections` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_token_idx` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `password_reset_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `recurring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`expected_amount_cents` integer NOT NULL,
	`amount_variance_percent` real DEFAULT 0,
	`frequency` text NOT NULL,
	`day_of_month` integer,
	`day_of_week` integer,
	`type` text NOT NULL,
	`is_subscription` integer DEFAULT false,
	`category_id` text,
	`account_id` text,
	`detection_method` text NOT NULL,
	`confidence` real DEFAULT 1,
	`status` text DEFAULT 'active' NOT NULL,
	`next_expected_date` text,
	`last_seen_date` text,
	`trial_ends_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurring_status_idx` ON `recurring_transactions` (`status`);--> statement-breakpoint
CREATE INDEX `recurring_type_idx` ON `recurring_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `recurring_next_date_idx` ON `recurring_transactions` (`next_expected_date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`user_agent` text,
	`ip_address` text,
	`device_type` text,
	`expires_at` integer NOT NULL,
	`is_valid` integer DEFAULT true NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_idx` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `spending_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`day_of_week` integer NOT NULL,
	`week_of_month` integer,
	`avg_spending_cents` integer NOT NULL,
	`median_spending_cents` integer,
	`max_spending_cents` integer,
	`is_danger_day` integer DEFAULT false,
	`overspend_probability` real DEFAULT 0,
	`category_breakdown` text,
	`sample_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pattern_day_idx` ON `spending_patterns` (`day_of_week`);--> statement-breakpoint
CREATE TABLE `transaction_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text,
	`raw_description` text NOT NULL,
	`raw_amount_cents` integer NOT NULL,
	`raw_date` text,
	`raw_merchant` text,
	`suggested_category_id` text,
	`suggested_account_id` text,
	`suggestion_confidence` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_transaction_id` text,
	`created_at` integer NOT NULL,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `inbox_status_idx` ON `transaction_inbox` (`status`);--> statement-breakpoint
CREATE INDEX `inbox_document_idx` ON `transaction_inbox` (`document_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`type` text NOT NULL,
	`category_id` text,
	`account_id` text NOT NULL,
	`cleared` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transaction_user_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transaction_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transaction_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transaction_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE TABLE `uploaded_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`status` text DEFAULT 'stored' NOT NULL,
	`failure_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `uploaded_file_user_idx` ON `uploaded_files` (`user_id`);--> statement-breakpoint
CREATE INDEX `uploaded_file_status_idx` ON `uploaded_files` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uploaded_file_storage_key_idx` ON `uploaded_files` (`storage_key`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`onboarding_step` integer DEFAULT 0 NOT NULL,
	`monthly_salary_cents` integer,
	`pay_frequency` text,
	`next_payday` text,
	`monthly_savings_goal_cents` integer,
	`emergency_fund_goal_cents` integer,
	`daily_spending_limit_cents` integer,
	`weekly_spending_limit_cents` integer,
	`copilot_tone` text DEFAULT 'sassy',
	`receive_proactive_tips` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profile_user_idx` ON `user_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`email_verified_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`preferences` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`plan_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_status_idx` ON `users` (`status`);