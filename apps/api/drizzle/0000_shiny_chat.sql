CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit', 'cash');--> statement-breakpoint
CREATE TYPE "public"."advisor_session_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('pending', 'sent', 'read', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('low_balance', 'bill_due', 'unusual_spending', 'subscription_renewal', 'debt_warning', 'budget_exceeded', 'goal_progress', 'income_received', 'duplicate_charge', 'price_increase', 'trial_ending', 'savings_opportunity');--> statement-breakpoint
CREATE TYPE "public"."billing_period" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."copilot_tone" AS ENUM('friendly', 'sassy', 'strict', 'gentle');--> statement-breakpoint
CREATE TYPE "public"."debt_status" AS ENUM('active', 'paid_off', 'defaulted', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."debt_type" AS ENUM('credit_card', 'personal_loan', 'auto_loan', 'mortgage', 'student_loan', 'medical', 'other');--> statement-breakpoint
CREATE TYPE "public"."detection_method" AS ENUM('ai_detected', 'user_created', 'email_parsed');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('web', 'mobile', 'desktop');--> statement-breakpoint
CREATE TYPE "public"."document_source_type" AS ENUM('screenshot', 'pdf_statement', 'receipt', 'email_attachment', 'manual_upload');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'completed', 'paused', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('savings', 'debt_payoff', 'purchase', 'emergency_fund', 'investment', 'other');--> statement-breakpoint
CREATE TYPE "public"."household_invite_role" AS ENUM('admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."household_member_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('pending', 'approved', 'rejected', 'merged');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."interview_step" AS ENUM('cash', 'income', 'bills', 'debts', 'spending', 'ant_expenses', 'savings', 'complete');--> statement-breakpoint
CREATE TYPE "public"."learned_from" AS ENUM('user_action', 'ai_suggestion', 'manual_rule');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'apple', 'github');--> statement-breakpoint
CREATE TYPE "public"."parsed_document_type" AS ENUM('receipt', 'invoice', 'bank_statement', 'excel_table');--> statement-breakpoint
CREATE TYPE "public"."pattern_type" AS ENUM('merchant', 'keyword', 'amount_range', 'description_regex');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('weekly', 'biweekly', 'semimonthly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('tilopay', 'stripe', 'manual');--> statement-breakpoint
CREATE TYPE "public"."primary_command_type" AS ENUM('pay', 'save', 'spend', 'freeze', 'wait');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'cancelled', 'trial');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('safe', 'caution', 'warning', 'danger', 'critical');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('pro', 'premium');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'cancelled', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."uploaded_file_status" AS ENUM('stored', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_plan" AS ENUM('free', 'pro', 'premium');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"institution" text,
	"type" "account_type" NOT NULL,
	"current_balance_cents" integer DEFAULT 0,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "advisor_session_status" DEFAULT 'active' NOT NULL,
	"conversation_history" text,
	"pending_changes" text,
	"last_confirmed_at" integer,
	"last_decision_recompute" integer,
	"created_at" integer NOT NULL,
	"last_activity_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "alert_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_entity" text,
	"actions" text,
	"status" "alert_status" DEFAULT 'pending' NOT NULL,
	"scheduled_for" integer,
	"sent_at" integer,
	"read_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_runway" (
	"id" text PRIMARY KEY NOT NULL,
	"current_balance_cents" integer NOT NULL,
	"calculated_at" integer NOT NULL,
	"days_until_zero" integer,
	"zero_date" text,
	"daily_burn_rate_cents" integer NOT NULL,
	"weekly_burn_rate_cents" integer NOT NULL,
	"upcoming_bills_cents" integer NOT NULL,
	"upcoming_bills_count" integer NOT NULL,
	"safe_to_spend_today_cents" integer NOT NULL,
	"safe_to_spend_week_cents" integer NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"emoji" text,
	"color" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"pattern_type" "pattern_type" NOT NULL,
	"pattern_value" text NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"learned_from" "learned_from" NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"forecast_date" text NOT NULL,
	"predicted_balance_cents" integer NOT NULL,
	"confidence_interval_cents" integer,
	"expected_income_cents" integer DEFAULT 0,
	"expected_expenses_cents" integer DEFAULT 0,
	"expected_bills_cents" integer DEFAULT 0,
	"cashflow_risk" "risk_level" DEFAULT 'safe' NOT NULL,
	"weather_emoji" text,
	"weather_summary" text,
	"recommendations" text,
	"generated_at" integer NOT NULL,
	"actual_balance_cents" integer
);
--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"summary_date" text NOT NULL,
	"weather_emoji" text NOT NULL,
	"weather_headline" text NOT NULL,
	"current_balance_cents" integer NOT NULL,
	"cash_runway_days" integer,
	"safe_to_spend_cents" integer,
	"yesterday_spent_cents" integer,
	"yesterday_earned_cents" integer,
	"bills_due_count" integer DEFAULT 0,
	"bills_due_amount_cents" integer DEFAULT 0,
	"summary_text" text NOT NULL,
	"coaching_tips" text,
	"warnings" text,
	"opportunities" text,
	"generated_at" integer NOT NULL,
	"sent_at" integer,
	"opened_at" integer
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"transaction_id" text,
	"amount_cents" integer NOT NULL,
	"principal_cents" integer,
	"interest_cents" integer,
	"payment_date" text NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "debt_type" NOT NULL,
	"account_id" text,
	"original_balance_cents" integer NOT NULL,
	"current_balance_cents" integer NOT NULL,
	"apr_percent" real NOT NULL,
	"minimum_payment_cents" integer,
	"term_months" integer,
	"start_date" text,
	"due_day" integer,
	"next_due_date" text,
	"status" "debt_status" DEFAULT 'active' NOT NULL,
	"death_date" text,
	"total_interest_projected_cents" integer,
	"danger_score" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"decision_version" text NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"primary_command_type" "primary_command_type" NOT NULL,
	"primary_command_text" text NOT NULL,
	"primary_command_amount_cents" integer,
	"primary_command_target" text,
	"primary_command_date" text,
	"warning_1" text,
	"warning_2" text,
	"next_action_text" text NOT NULL,
	"next_action_url" text NOT NULL,
	"decision_basis_json" text,
	"computed_at" integer NOT NULL,
	"expires_at" integer NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"acknowledged_at" integer
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size_bytes" integer,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"source_type" "document_source_type" NOT NULL,
	"extracted_data" text,
	"extraction_confidence" real,
	"processed_at" integer,
	"error_message" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "envelopes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"month" text NOT NULL,
	"budget_cents" integer NOT NULL,
	"spent_cents" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_imported_items" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"parsed_item_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_parsed_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"parser_version" text NOT NULL,
	"document_type" "parsed_document_type" NOT NULL,
	"summary_json" text NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"emoji" text,
	"target_amount_cents" integer NOT NULL,
	"current_amount_cents" integer DEFAULT 0 NOT NULL,
	"target_date" text,
	"start_date" text NOT NULL,
	"goal_type" "goal_type" NOT NULL,
	"linked_debt_id" text,
	"linked_account_id" text,
	"progress_percent" real DEFAULT 0 NOT NULL,
	"on_track" boolean DEFAULT true,
	"projected_completion_date" text,
	"recommended_monthly_cents" integer,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"completed_at" integer
);
--> statement-breakpoint
CREATE TABLE "household_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"role" "household_invite_role" DEFAULT 'member' NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer,
	"created_by_id" text NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "household_member_role" DEFAULT 'member' NOT NULL,
	"invited_at" integer NOT NULL,
	"accepted_at" integer
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"invite_code" text,
	"created_by_id" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "interview_status" DEFAULT 'in_progress' NOT NULL,
	"current_step" "interview_step" DEFAULT 'cash' NOT NULL,
	"conversation_history" text,
	"extracted_data" text,
	"insight_flags" text,
	"uploaded_file_ids" text,
	"started_at" integer NOT NULL,
	"completed_at" integer,
	"last_activity_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"total_income_cents" integer DEFAULT 0 NOT NULL,
	"income_variance_percent" real,
	"total_spending_cents" integer DEFAULT 0 NOT NULL,
	"spending_variance_percent" real,
	"net_savings_cents" integer DEFAULT 0 NOT NULL,
	"savings_rate_percent" real,
	"category_totals" text,
	"danger_days_count" integer DEFAULT 0,
	"overspend_days_count" integer DEFAULT 0,
	"ai_insights" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"expected_amount_cents" integer NOT NULL,
	"amount_variance_percent" real DEFAULT 0,
	"frequency" "recurrence_frequency" NOT NULL,
	"day_of_month" integer,
	"day_of_week" integer,
	"type" "transaction_type" NOT NULL,
	"is_subscription" boolean DEFAULT false,
	"category_id" text,
	"account_id" text,
	"detection_method" "detection_method" NOT NULL,
	"confidence" real DEFAULT 1,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"next_expected_date" text,
	"last_seen_date" text,
	"trial_ends_date" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"device_type" "device_type",
	"expires_at" integer NOT NULL,
	"is_valid" boolean DEFAULT true NOT NULL,
	"revoked_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"day_of_week" integer NOT NULL,
	"week_of_month" integer,
	"avg_spending_cents" integer NOT NULL,
	"median_spending_cents" integer,
	"max_spending_cents" integer,
	"is_danger_day" boolean DEFAULT false,
	"overspend_probability" real DEFAULT 0,
	"category_breakdown" text,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"billing_period" "billing_period" NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"provider" "payment_provider" DEFAULT 'tilopay' NOT NULL,
	"provider_order_number" text,
	"provider_transaction_id" text,
	"provider_auth" text,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"start_date" integer,
	"end_date" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text,
	"raw_description" text NOT NULL,
	"raw_amount_cents" integer NOT NULL,
	"raw_date" text,
	"raw_merchant" text,
	"suggested_category_id" text,
	"suggested_account_id" text,
	"suggestion_confidence" real,
	"status" "inbox_status" DEFAULT 'pending' NOT NULL,
	"approved_transaction_id" text,
	"created_at" integer NOT NULL,
	"reviewed_at" integer
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"category_id" text,
	"account_id" text NOT NULL,
	"cleared" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" "uploaded_file_status" DEFAULT 'stored' NOT NULL,
	"failure_reason" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"monthly_salary_cents" integer,
	"pay_frequency" "pay_frequency",
	"next_payday" text,
	"monthly_savings_goal_cents" integer,
	"emergency_fund_goal_cents" integer,
	"daily_spending_limit_cents" integer,
	"weekly_spending_limit_cents" integer,
	"copilot_tone" "copilot_tone" DEFAULT 'sassy',
	"receive_proactive_tips" boolean DEFAULT true,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" integer,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"preferences" text,
	"plan" "user_plan" DEFAULT 'free' NOT NULL,
	"plan_expires_at" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"last_login_at" integer
);
--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "advisor_session_user_idx" ON "advisor_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "advisor_session_status_idx" ON "advisor_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alert_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alert_type_idx" ON "alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alert_scheduled_idx" ON "alerts" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "runway_calculated_idx" ON "cash_runway" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "category_user_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pattern_category_idx" ON "category_patterns" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "pattern_type_value_idx" ON "category_patterns" USING btree ("pattern_type","pattern_value");--> statement-breakpoint
CREATE INDEX "forecast_date_idx" ON "daily_forecasts" USING btree ("forecast_date");--> statement-breakpoint
CREATE INDEX "summary_date_idx" ON "daily_summaries" USING btree ("summary_date");--> statement-breakpoint
CREATE INDEX "debt_payment_debt_idx" ON "debt_payments" USING btree ("debt_id");--> statement-breakpoint
CREATE INDEX "debt_payment_date_idx" ON "debt_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "debt_status_idx" ON "debts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "debt_danger_idx" ON "debts" USING btree ("danger_score");--> statement-breakpoint
CREATE INDEX "decision_state_user_idx" ON "decision_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "decision_state_expires_idx" ON "decision_state" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "document_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_source_idx" ON "documents" USING btree ("source_type");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_token_idx" ON "email_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "email_verification_user_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "envelope_user_idx" ON "envelopes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "envelope_month_category_idx" ON "envelopes" USING btree ("month","category_id");--> statement-breakpoint
CREATE INDEX "imported_item_file_idx" ON "file_imported_items" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "imported_item_transaction_idx" ON "file_imported_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "imported_item_unique_idx" ON "file_imported_items" USING btree ("file_id","parsed_item_id");--> statement-breakpoint
CREATE INDEX "parsed_summary_file_idx" ON "file_parsed_summaries" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "parsed_summary_version_idx" ON "file_parsed_summaries" USING btree ("parser_version");--> statement-breakpoint
CREATE INDEX "goal_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goal_status_idx" ON "goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "goal_type_idx" ON "goals" USING btree ("goal_type");--> statement-breakpoint
CREATE UNIQUE INDEX "household_invite_token_idx" ON "household_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "household_invite_household_idx" ON "household_invites" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_invite_email_idx" ON "household_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "household_member_household_idx" ON "household_members" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_member_user_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_member_unique_idx" ON "household_members" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_invite_code_idx" ON "households" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "household_created_by_idx" ON "households" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_session_user_idx" ON "interview_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interview_session_status_idx" ON "interview_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "snapshot_month_idx" ON "monthly_snapshots" USING btree ("month");--> statement-breakpoint
CREATE INDEX "oauth_user_idx" ON "oauth_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_idx" ON "oauth_connections" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_status_idx" ON "recurring_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recurring_type_idx" ON "recurring_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "recurring_next_date_idx" ON "recurring_transactions" USING btree ("next_expected_date");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "pattern_day_idx" ON "spending_patterns" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "subscription_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_order_idx" ON "subscriptions" USING btree ("provider_order_number");--> statement-breakpoint
CREATE INDEX "inbox_status_idx" ON "transaction_inbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inbox_document_idx" ON "transaction_inbox" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "transaction_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transaction_category_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transaction_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "uploaded_file_user_idx" ON "uploaded_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "uploaded_file_status_idx" ON "uploaded_files" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uploaded_file_storage_key_idx" ON "uploaded_files" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_user_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "users" USING btree ("status");