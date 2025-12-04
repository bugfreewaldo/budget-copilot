import 'dotenv/config';
import { initializeDatabase, flushSave } from './client.js';
import { sql } from 'drizzle-orm';

/**
 * Run database migrations for SQL.js
 * Creates tables and indexes if they don't exist
 */
async function runMigrations() {
  console.log('🔄 Running migrations...');

  const db = await initializeDatabase();

  try {
    // ========================================================================
    // USER AUTHENTICATION TABLES
    // ========================================================================

    // Users table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        email_verified_at INTEGER,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
        preferences TEXT,
        plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'premium')),
        plan_expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_login_at INTEGER
      )
    `);

    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_email_idx ON users(email)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS user_status_idx ON users(status)`);

    // Sessions table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        device_type TEXT CHECK(device_type IN ('web', 'mobile', 'desktop')),
        expires_at INTEGER NOT NULL,
        is_valid INTEGER NOT NULL DEFAULT 1,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS session_token_idx ON sessions(token)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS session_user_idx ON sessions(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS session_expires_idx ON sessions(expires_at)`);

    // Password reset tokens table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS password_reset_token_idx ON password_reset_tokens(token)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id)`);

    // Email verification tokens table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        email TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS email_verification_token_idx ON email_verification_tokens(token)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS email_verification_user_idx ON email_verification_tokens(user_id)`);

    // OAuth connections table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS oauth_connections (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL CHECK(provider IN ('google', 'apple', 'github')),
        provider_user_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS oauth_user_idx ON oauth_connections(user_id)`);
    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS oauth_provider_idx ON oauth_connections(provider, provider_user_id)`);

    // ========================================================================
    // CORE FINANCIAL ENTITIES
    // ========================================================================

    // Create accounts table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        institution TEXT,
        type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit', 'cash')),
        current_balance_cents INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS account_user_idx ON accounts(user_id)`);

    // Create categories table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT,
        emoji TEXT,
        color TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS category_user_idx ON categories(user_id)`);

    // Create envelopes table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS envelopes (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        month TEXT NOT NULL,
        budget_cents INTEGER NOT NULL,
        spent_cents INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS envelope_user_idx ON envelopes(user_id)`);

    // Create transactions table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        category_id TEXT,
        account_id TEXT NOT NULL,
        cleared INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS transaction_user_idx ON transactions(user_id)`);

    // Create indexes for core tables
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS envelope_month_category_idx ON envelopes(month, category_id)
    `);

    await db.run(sql`
      CREATE INDEX IF NOT EXISTS transaction_date_idx ON transactions(date)
    `);

    await db.run(sql`
      CREATE INDEX IF NOT EXISTS transaction_category_idx ON transactions(category_id)
    `);

    await db.run(sql`
      CREATE INDEX IF NOT EXISTS transaction_account_idx ON transactions(account_id)
    `);

    // ========================================================================
    // DEBT COPILOT TABLES
    // ========================================================================

    // Debts table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('credit_card', 'personal_loan', 'auto_loan', 'mortgage', 'student_loan', 'medical', 'other')),
        account_id TEXT,
        original_balance_cents INTEGER NOT NULL,
        current_balance_cents INTEGER NOT NULL,
        apr_percent REAL NOT NULL,
        minimum_payment_cents INTEGER,
        due_day INTEGER,
        next_due_date TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paid_off', 'defaulted', 'deferred')),
        death_date TEXT,
        total_interest_projected_cents INTEGER,
        danger_score INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS debt_user_idx ON debts(user_id)`);

    await db.run(sql`CREATE INDEX IF NOT EXISTS debt_status_idx ON debts(status)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS debt_danger_idx ON debts(danger_score)`);

    // Debt payments table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id TEXT PRIMARY KEY NOT NULL,
        debt_id TEXT NOT NULL,
        transaction_id TEXT,
        amount_cents INTEGER NOT NULL,
        principal_cents INTEGER,
        interest_cents INTEGER,
        payment_date TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS debt_payment_debt_idx ON debt_payments(debt_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS debt_payment_date_idx ON debt_payments(payment_date)`);

    // ========================================================================
    // DOCUMENT PROCESSING TABLES
    // ========================================================================

    // Documents table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        source_type TEXT NOT NULL CHECK(source_type IN ('screenshot', 'pdf_statement', 'receipt', 'email_attachment', 'manual_upload')),
        extracted_data TEXT,
        extraction_confidence REAL,
        processed_at INTEGER,
        error_message TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS document_status_idx ON documents(status)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS document_source_idx ON documents(source_type)`);

    // ========================================================================
    // TRANSACTION INBOX TABLES
    // ========================================================================

    // Transaction inbox table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS transaction_inbox (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT,
        raw_description TEXT NOT NULL,
        raw_amount_cents INTEGER NOT NULL,
        raw_date TEXT,
        raw_merchant TEXT,
        suggested_category_id TEXT,
        suggested_account_id TEXT,
        suggestion_confidence REAL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'merged')),
        approved_transaction_id TEXT,
        created_at INTEGER NOT NULL,
        reviewed_at INTEGER
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS inbox_status_idx ON transaction_inbox(status)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS inbox_document_idx ON transaction_inbox(document_id)`);

    // ========================================================================
    // CATEGORY LEARNING TABLES
    // ========================================================================

    // Category patterns table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS category_patterns (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL,
        pattern_type TEXT NOT NULL CHECK(pattern_type IN ('merchant', 'keyword', 'amount_range', 'description_regex')),
        pattern_value TEXT NOT NULL,
        match_count INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 0.5,
        learned_from TEXT NOT NULL CHECK(learned_from IN ('user_action', 'ai_suggestion', 'manual_rule')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS pattern_category_idx ON category_patterns(category_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS pattern_type_value_idx ON category_patterns(pattern_type, pattern_value)`);

    // ========================================================================
    // RECURRING TRANSACTIONS TABLES
    // ========================================================================

    // Recurring transactions table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        expected_amount_cents INTEGER NOT NULL,
        amount_variance_percent REAL DEFAULT 0,
        frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
        day_of_month INTEGER,
        day_of_week INTEGER,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        is_subscription INTEGER DEFAULT 0,
        category_id TEXT,
        account_id TEXT,
        detection_method TEXT NOT NULL CHECK(detection_method IN ('ai_detected', 'user_created', 'email_parsed')),
        confidence REAL DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'cancelled', 'trial')),
        next_expected_date TEXT,
        last_seen_date TEXT,
        trial_ends_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS recurring_status_idx ON recurring_transactions(status)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS recurring_type_idx ON recurring_transactions(type)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS recurring_next_date_idx ON recurring_transactions(next_expected_date)`);

    // ========================================================================
    // BEHAVIOR MODEL TABLES
    // ========================================================================

    // Spending patterns table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS spending_patterns (
        id TEXT PRIMARY KEY NOT NULL,
        day_of_week INTEGER NOT NULL,
        week_of_month INTEGER,
        avg_spending_cents INTEGER NOT NULL,
        median_spending_cents INTEGER,
        max_spending_cents INTEGER,
        is_danger_day INTEGER DEFAULT 0,
        overspend_probability REAL DEFAULT 0,
        category_breakdown TEXT,
        sample_count INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS pattern_day_idx ON spending_patterns(day_of_week)`);

    // Monthly snapshots table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS monthly_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        month TEXT NOT NULL,
        total_income_cents INTEGER NOT NULL DEFAULT 0,
        income_variance_percent REAL,
        total_spending_cents INTEGER NOT NULL DEFAULT 0,
        spending_variance_percent REAL,
        net_savings_cents INTEGER NOT NULL DEFAULT 0,
        savings_rate_percent REAL,
        category_totals TEXT,
        danger_days_count INTEGER DEFAULT 0,
        overspend_days_count INTEGER DEFAULT 0,
        ai_insights TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS snapshot_month_idx ON monthly_snapshots(month)`);

    // ========================================================================
    // PREDICTIONS & FORECASTS TABLES
    // ========================================================================

    // Daily forecasts table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS daily_forecasts (
        id TEXT PRIMARY KEY NOT NULL,
        forecast_date TEXT NOT NULL,
        predicted_balance_cents INTEGER NOT NULL,
        confidence_interval_cents INTEGER,
        expected_income_cents INTEGER DEFAULT 0,
        expected_expenses_cents INTEGER DEFAULT 0,
        expected_bills_cents INTEGER DEFAULT 0,
        cashflow_risk TEXT NOT NULL DEFAULT 'safe' CHECK(cashflow_risk IN ('safe', 'caution', 'warning', 'danger', 'critical')),
        weather_emoji TEXT,
        weather_summary TEXT,
        recommendations TEXT,
        generated_at INTEGER NOT NULL,
        actual_balance_cents INTEGER
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS forecast_date_idx ON daily_forecasts(forecast_date)`);

    // Cash runway table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS cash_runway (
        id TEXT PRIMARY KEY NOT NULL,
        current_balance_cents INTEGER NOT NULL,
        calculated_at INTEGER NOT NULL,
        days_until_zero INTEGER,
        zero_date TEXT,
        daily_burn_rate_cents INTEGER NOT NULL,
        weekly_burn_rate_cents INTEGER NOT NULL,
        upcoming_bills_cents INTEGER NOT NULL,
        upcoming_bills_count INTEGER NOT NULL,
        safe_to_spend_today_cents INTEGER NOT NULL,
        safe_to_spend_week_cents INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS runway_calculated_idx ON cash_runway(calculated_at)`);

    // ========================================================================
    // ALERTS TABLES
    // ========================================================================

    // Alerts table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('low_balance', 'bill_due', 'unusual_spending', 'subscription_renewal', 'debt_warning', 'budget_exceeded', 'goal_progress', 'income_received', 'duplicate_charge', 'price_increase', 'trial_ending', 'savings_opportunity')),
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'urgent', 'critical')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_entity TEXT,
        actions TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'read', 'dismissed', 'actioned')),
        scheduled_for INTEGER,
        sent_at INTEGER,
        read_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS alert_status_idx ON alerts(status)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS alert_type_idx ON alerts(type)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS alert_scheduled_idx ON alerts(scheduled_for)`);

    // ========================================================================
    // GOALS TABLES
    // ========================================================================

    // Goals table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        emoji TEXT,
        target_amount_cents INTEGER NOT NULL,
        current_amount_cents INTEGER NOT NULL DEFAULT 0,
        target_date TEXT,
        start_date TEXT NOT NULL,
        goal_type TEXT NOT NULL CHECK(goal_type IN ('savings', 'debt_payoff', 'purchase', 'emergency_fund', 'investment', 'other')),
        linked_debt_id TEXT,
        linked_account_id TEXT,
        progress_percent REAL NOT NULL DEFAULT 0,
        on_track INTEGER DEFAULT 1,
        projected_completion_date TEXT,
        recommended_monthly_cents INTEGER,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused', 'abandoned')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS goal_status_idx ON goals(status)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS goal_type_idx ON goals(goal_type)`);

    // ========================================================================
    // DAILY SUMMARIES TABLES
    // ========================================================================

    // Daily summaries table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id TEXT PRIMARY KEY NOT NULL,
        summary_date TEXT NOT NULL,
        weather_emoji TEXT NOT NULL,
        weather_headline TEXT NOT NULL,
        current_balance_cents INTEGER NOT NULL,
        cash_runway_days INTEGER,
        safe_to_spend_cents INTEGER,
        yesterday_spent_cents INTEGER,
        yesterday_earned_cents INTEGER,
        bills_due_count INTEGER DEFAULT 0,
        bills_due_amount_cents INTEGER DEFAULT 0,
        summary_text TEXT NOT NULL,
        coaching_tips TEXT,
        warnings TEXT,
        opportunities TEXT,
        generated_at INTEGER NOT NULL,
        sent_at INTEGER,
        opened_at INTEGER
      )
    `);

    await db.run(sql`CREATE INDEX IF NOT EXISTS summary_date_idx ON daily_summaries(summary_date)`);

    // Flush database to disk immediately after migrations
    await flushSave();

    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }
}

// Run if called directly
const isMainModule = () => {
  const scriptPath = process.argv[1]?.replace(/\\/g, '/');
  const moduleUrl = import.meta.url.replace('file:///', '').replace('file://', '');
  return moduleUrl.endsWith(scriptPath?.split('/').pop() || '') ||
         import.meta.url === `file://${scriptPath}`;
};

if (isMainModule()) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { runMigrations };
