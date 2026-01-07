import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Database schema for Budget Copilot - The Money Brain™
 * A comprehensive personal finance AI system
 * Using SQL.js (WASM SQLite) for Windows compatibility
 */

// ============================================================================
// USER AUTHENTICATION & IDENTITY
// ============================================================================

// Users table - core authentication
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),

    // Authentication
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),

    // Profile
    name: text('name'),
    avatarUrl: text('avatar_url'),

    // Email verification
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .notNull()
      .default(false),
    emailVerifiedAt: integer('email_verified_at'),

    // Account status
    status: text('status', {
      enum: ['active', 'suspended', 'deleted'],
    })
      .notNull()
      .default('active'),

    // Preferences (JSON)
    preferences: text('preferences'), // { currency: 'USD', language: 'es', timezone: 'America/Panama' }

    // Subscription/Plan
    plan: text('plan', {
      enum: ['free', 'pro', 'premium'],
    })
      .notNull()
      .default('free'),
    planExpiresAt: integer('plan_expires_at'),

    // Timestamps
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    lastLoginAt: integer('last_login_at'),
  },
  (table) => ({
    emailIdx: uniqueIndex('user_email_idx').on(table.email),
    statusIdx: index('user_status_idx').on(table.status),
  })
);

// Sessions - token-based auth sessions
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Token
    token: text('token').notNull(),

    // Device info
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    deviceType: text('device_type', { enum: ['web', 'mobile', 'desktop'] }),

    // Expiration
    expiresAt: integer('expires_at').notNull(),

    // Status
    isValid: integer('is_valid', { mode: 'boolean' }).notNull().default(true),
    revokedAt: integer('revoked_at'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    tokenIdx: uniqueIndex('session_token_idx').on(table.token),
    userIdx: index('session_user_idx').on(table.userId),
    expiresIdx: index('session_expires_idx').on(table.expiresAt),
  })
);

// Password reset tokens
export const passwordResetTokens = sqliteTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    token: text('token').notNull(),
    expiresAt: integer('expires_at').notNull(),

    usedAt: integer('used_at'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    tokenIdx: uniqueIndex('password_reset_token_idx').on(table.token),
    userIdx: index('password_reset_user_idx').on(table.userId),
  })
);

// Email verification tokens
export const emailVerificationTokens = sqliteTable(
  'email_verification_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    token: text('token').notNull(),
    email: text('email').notNull(), // The email being verified
    expiresAt: integer('expires_at').notNull(),

    usedAt: integer('used_at'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    tokenIdx: uniqueIndex('email_verification_token_idx').on(table.token),
    userIdx: index('email_verification_user_idx').on(table.userId),
  })
);

// ============================================================================
// HOUSEHOLDS - Family sharing
// ============================================================================

// Households table - family/group sharing
export const households = sqliteTable(
  'households',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    inviteCode: text('invite_code'), // Optional static invite code
    createdById: text('created_by_id').notNull(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    inviteCodeIdx: uniqueIndex('household_invite_code_idx').on(
      table.inviteCode
    ),
    createdByIdx: index('household_created_by_idx').on(table.createdById),
  })
);

// Household members - links users to households
export const householdMembers = sqliteTable(
  'household_members',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] })
      .notNull()
      .default('member'),
    invitedAt: integer('invited_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    acceptedAt: integer('accepted_at'),
  },
  (table) => ({
    householdIdx: index('household_member_household_idx').on(table.householdId),
    userIdx: index('household_member_user_idx').on(table.userId),
    uniqueMemberIdx: uniqueIndex('household_member_unique_idx').on(
      table.householdId,
      table.userId
    ),
  })
);

// Household invites - pending invitations
export const householdInvites = sqliteTable(
  'household_invites',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    email: text('email'), // Optional - if null, anyone with link can join
    token: text('token').notNull(),
    role: text('role', { enum: ['admin', 'member', 'viewer'] })
      .notNull()
      .default('member'),
    expiresAt: integer('expires_at').notNull(),
    usedAt: integer('used_at'),
    createdById: text('created_by_id').notNull(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    tokenIdx: uniqueIndex('household_invite_token_idx').on(table.token),
    householdIdx: index('household_invite_household_idx').on(table.householdId),
    emailIdx: index('household_invite_email_idx').on(table.email),
  })
);

// OAuth connections (for future Google/Apple login)
export const oauthConnections = sqliteTable(
  'oauth_connections',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    provider: text('provider', {
      enum: ['google', 'apple', 'github'],
    }).notNull(),
    providerUserId: text('provider_user_id').notNull(),

    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: integer('expires_at'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('oauth_user_idx').on(table.userId),
    providerIdx: uniqueIndex('oauth_provider_idx').on(
      table.provider,
      table.providerUserId
    ),
  })
);

// ============================================================================
// USER FINANCIAL PROFILE - Onboarding and financial info
// ============================================================================

// User financial profile - stores salary, pay frequency, etc.
export const userProfiles = sqliteTable(
  'user_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Onboarding status
    onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    onboardingStep: integer('onboarding_step').notNull().default(0), // 0=not started, 1=salary, 2=frequency, 3=debts, etc.

    // Income info
    monthlySalaryCents: integer('monthly_salary_cents'),
    payFrequency: text('pay_frequency', {
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
    }),
    nextPayday: text('next_payday'), // ISO date

    // Financial goals
    monthlySavingsGoalCents: integer('monthly_savings_goal_cents'),
    emergencyFundGoalCents: integer('emergency_fund_goal_cents'),

    // Spending limits
    dailySpendingLimitCents: integer('daily_spending_limit_cents'),
    weeklySpendingLimitCents: integer('weekly_spending_limit_cents'),

    // Copilot preferences
    copilotTone: text('copilot_tone', {
      enum: ['friendly', 'sassy', 'strict', 'gentle'],
    }).default('sassy'),
    receiveProactiveTips: integer('receive_proactive_tips', {
      mode: 'boolean',
    }).default(true),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: uniqueIndex('user_profile_user_idx').on(table.userId),
  })
);

// ============================================================================
// CORE FINANCIAL ENTITIES
// ============================================================================

// Accounts table
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // Owner of this account
    name: text('name').notNull(),
    institution: text('institution'),
    type: text('type', {
      enum: ['checking', 'savings', 'credit', 'cash'],
    }).notNull(),
    currentBalanceCents: integer('current_balance_cents').default(0),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('account_user_idx').on(table.userId),
  })
);

// Categories table with hierarchical support
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // Owner of this category
    name: text('name').notNull(),
    parentId: text('parent_id'),
    emoji: text('emoji'), // Optional emoji icon
    color: text('color'), // Optional hex color
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('category_user_idx').on(table.userId),
  })
);

// Envelopes table (monthly budgets per category)
export const envelopes = sqliteTable(
  'envelopes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id').notNull(),
    month: text('month').notNull(), // YYYY-MM format
    budgetCents: integer('budget_cents').notNull(), // Amount in cents
    spentCents: integer('spent_cents').notNull().default(0), // Track spending
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('envelope_user_idx').on(table.userId),
    monthCategoryIdx: index('envelope_month_category_idx').on(
      table.month,
      table.categoryId
    ),
  })
);

// Transactions table
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    date: text('date').notNull(), // ISO date string YYYY-MM-DD
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(), // Positive for income, negative for expense
    type: text('type', { enum: ['income', 'expense'] }).notNull(),
    categoryId: text('category_id'),
    accountId: text('account_id').notNull(),
    cleared: integer('cleared', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('transaction_user_idx').on(table.userId),
    dateIdx: index('transaction_date_idx').on(table.date),
    categoryIdx: index('transaction_category_idx').on(table.categoryId),
    accountIdx: index('transaction_account_idx').on(table.accountId),
  })
);

// ============================================================================
// DEBT COPILOT - Debt tracking and payoff projections
// ============================================================================

// Debts table - credit cards, loans, mortgages, etc.
export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(), // "Chase Sapphire", "Car Loan", etc.
    type: text('type', {
      enum: [
        'credit_card',
        'personal_loan',
        'auto_loan',
        'mortgage',
        'student_loan',
        'medical',
        'other',
      ],
    }).notNull(),
    accountId: text('account_id'), // Link to account if applicable

    // Balance tracking
    originalBalanceCents: integer('original_balance_cents').notNull(),
    currentBalanceCents: integer('current_balance_cents').notNull(),

    // Interest and terms
    aprPercent: real('apr_percent').notNull(), // Annual percentage rate
    minimumPaymentCents: integer('minimum_payment_cents'),
    termMonths: integer('term_months'), // Loan duration in months (null for revolving credit like credit cards)
    startDate: text('start_date'), // ISO date when loan was originated (optional)

    // Due dates
    dueDay: integer('due_day'), // Day of month (1-31)
    nextDueDate: text('next_due_date'), // ISO date

    // Status
    status: text('status', {
      enum: ['active', 'paid_off', 'defaulted', 'deferred'],
    })
      .notNull()
      .default('active'),

    // AI-computed fields
    deathDate: text('death_date'), // Projected payoff date at current rate
    totalInterestProjectedCents: integer('total_interest_projected_cents'),
    dangerScore: integer('danger_score'), // 0-100, how much this debt threatens cashflow

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    statusIdx: index('debt_status_idx').on(table.status),
    dangerIdx: index('debt_danger_idx').on(table.dangerScore),
  })
);

// Debt payment history
export const debtPayments = sqliteTable(
  'debt_payments',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    transactionId: text('transaction_id'), // Link to transaction if imported

    amountCents: integer('amount_cents').notNull(),
    principalCents: integer('principal_cents'), // Portion going to principal
    interestCents: integer('interest_cents'), // Portion going to interest

    paymentDate: text('payment_date').notNull(), // ISO date

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    debtIdx: index('debt_payment_debt_idx').on(table.debtId),
    dateIdx: index('debt_payment_date_idx').on(table.paymentDate),
  })
);

// ============================================================================
// DOCUMENT PROCESSING - Screenshot/PDF parsing
// ============================================================================

// Uploaded documents (screenshots, PDFs, statements)
export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),

    // File info
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    filePath: text('file_path').notNull(), // Local storage path
    fileSizeBytes: integer('file_size_bytes'),

    // Processing status
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),

    // Source type
    sourceType: text('source_type', {
      enum: [
        'screenshot',
        'pdf_statement',
        'receipt',
        'email_attachment',
        'manual_upload',
      ],
    }).notNull(),

    // AI extraction results
    extractedData: text('extracted_data'), // JSON blob of parsed data
    extractionConfidence: real('extraction_confidence'), // 0-1 confidence score

    // Processing metadata
    processedAt: integer('processed_at'),
    errorMessage: text('error_message'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    statusIdx: index('document_status_idx').on(table.status),
    sourceTypeIdx: index('document_source_idx').on(table.sourceType),
  })
);

// ============================================================================
// TRANSACTION INBOX - Swipe-to-categorize system
// ============================================================================

// Pending transactions awaiting user review
export const transactionInbox = sqliteTable(
  'transaction_inbox',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id'), // Source document if from upload

    // Raw extracted data
    rawDescription: text('raw_description').notNull(),
    rawAmountCents: integer('raw_amount_cents').notNull(),
    rawDate: text('raw_date'), // ISO date, may be missing
    rawMerchant: text('raw_merchant'),

    // AI suggestions
    suggestedCategoryId: text('suggested_category_id'),
    suggestedAccountId: text('suggested_account_id'),
    suggestionConfidence: real('suggestion_confidence'), // 0-1

    // Status
    status: text('status', {
      enum: ['pending', 'approved', 'rejected', 'merged'],
    })
      .notNull()
      .default('pending'),

    // If approved, link to created transaction
    approvedTransactionId: text('approved_transaction_id'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    reviewedAt: integer('reviewed_at'),
  },
  (table) => ({
    statusIdx: index('inbox_status_idx').on(table.status),
    documentIdx: index('inbox_document_idx').on(table.documentId),
  })
);

// ============================================================================
// CATEGORY LEARNING - Auto-categorization AI
// ============================================================================

// Category learning patterns - AI learns from user categorizations
export const categoryPatterns = sqliteTable(
  'category_patterns',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id').notNull(),

    // Pattern matching
    patternType: text('pattern_type', {
      enum: ['merchant', 'keyword', 'amount_range', 'description_regex'],
    }).notNull(),
    patternValue: text('pattern_value').notNull(), // The actual pattern

    // Learning metrics
    matchCount: integer('match_count').notNull().default(0),
    confidence: real('confidence').notNull().default(0.5), // Grows with successful matches

    // Source
    learnedFrom: text('learned_from', {
      enum: ['user_action', 'ai_suggestion', 'manual_rule'],
    }).notNull(),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    categoryIdx: index('pattern_category_idx').on(table.categoryId),
    patternIdx: index('pattern_type_value_idx').on(
      table.patternType,
      table.patternValue
    ),
  })
);

// ============================================================================
// RECURRING TRANSACTIONS - Subscriptions and bills
// ============================================================================

// Detected recurring transactions (subscriptions, bills, income)
export const recurringTransactions = sqliteTable(
  'recurring_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Description
    name: text('name').notNull(), // "Netflix", "Rent", "Salary"
    description: text('description'),

    // Amount (can vary for some bills)
    expectedAmountCents: integer('expected_amount_cents').notNull(),
    amountVariancePercent: real('amount_variance_percent').default(0), // Allowed variance

    // Frequency
    frequency: text('frequency', {
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
    }).notNull(),
    dayOfMonth: integer('day_of_month'), // For monthly
    dayOfWeek: integer('day_of_week'), // For weekly (0=Sun, 6=Sat)

    // Type
    type: text('type', { enum: ['income', 'expense'] }).notNull(),
    isSubscription: integer('is_subscription', { mode: 'boolean' }).default(
      false
    ),

    // Categorization
    categoryId: text('category_id'),
    accountId: text('account_id'),

    // Detection
    detectionMethod: text('detection_method', {
      enum: ['ai_detected', 'user_created', 'email_parsed'],
    }).notNull(),
    confidence: real('confidence').default(1.0),

    // Status
    status: text('status', {
      enum: ['active', 'paused', 'cancelled', 'trial'],
    })
      .notNull()
      .default('active'),

    // Dates
    nextExpectedDate: text('next_expected_date'), // ISO date
    lastSeenDate: text('last_seen_date'), // ISO date
    trialEndsDate: text('trial_ends_date'), // For subscription trials

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    statusIdx: index('recurring_status_idx').on(table.status),
    typeIdx: index('recurring_type_idx').on(table.type),
    nextDateIdx: index('recurring_next_date_idx').on(table.nextExpectedDate),
  })
);

// ============================================================================
// BEHAVIOR MODEL - The Money Brain™ behavioral intelligence
// ============================================================================

// Daily spending patterns
export const spendingPatterns = sqliteTable(
  'spending_patterns',
  {
    id: text('id').primaryKey(),

    // Time dimension
    dayOfWeek: integer('day_of_week').notNull(), // 0=Sun, 6=Sat
    weekOfMonth: integer('week_of_month'), // 1-5

    // Aggregated metrics
    avgSpendingCents: integer('avg_spending_cents').notNull(),
    medianSpendingCents: integer('median_spending_cents'),
    maxSpendingCents: integer('max_spending_cents'),

    // Behavior flags
    isDangerDay: integer('is_danger_day', { mode: 'boolean' }).default(false),
    overspendProbability: real('overspend_probability').default(0), // 0-1

    // Category breakdown (JSON: { categoryId: avgCents })
    categoryBreakdown: text('category_breakdown'),

    // Sample size
    sampleCount: integer('sample_count').notNull().default(0),

    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    dayIdx: index('pattern_day_idx').on(table.dayOfWeek),
  })
);

// Monthly behavior snapshots
export const monthlySnapshots = sqliteTable(
  'monthly_snapshots',
  {
    id: text('id').primaryKey(),
    month: text('month').notNull(), // YYYY-MM format

    // Income metrics
    totalIncomeCents: integer('total_income_cents').notNull().default(0),
    incomeVariancePercent: real('income_variance_percent'), // vs average

    // Spending metrics
    totalSpendingCents: integer('total_spending_cents').notNull().default(0),
    spendingVariancePercent: real('spending_variance_percent'), // vs average

    // Savings
    netSavingsCents: integer('net_savings_cents').notNull().default(0),
    savingsRatePercent: real('savings_rate_percent'),

    // Category breakdown (JSON)
    categoryTotals: text('category_totals'),

    // Behavioral metrics
    dangerDaysCount: integer('danger_days_count').default(0),
    overspendDaysCount: integer('overspend_days_count').default(0),

    // AI insights (JSON array of insight objects)
    aiInsights: text('ai_insights'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    monthIdx: index('snapshot_month_idx').on(table.month),
  })
);

// ============================================================================
// PREDICTIONS & FORECASTS - Financial weather system
// ============================================================================

// Daily financial forecasts
export const dailyForecasts = sqliteTable(
  'daily_forecasts',
  {
    id: text('id').primaryKey(),
    forecastDate: text('forecast_date').notNull(), // ISO date being forecasted

    // Balance predictions
    predictedBalanceCents: integer('predicted_balance_cents').notNull(),
    confidenceInterval: integer('confidence_interval_cents'), // +/- this amount

    // Expected events
    expectedIncomeCents: integer('expected_income_cents').default(0),
    expectedExpensesCents: integer('expected_expenses_cents').default(0),
    expectedBillsCents: integer('expected_bills_cents').default(0),

    // Risk assessment
    cashflowRisk: text('cashflow_risk', {
      enum: ['safe', 'caution', 'warning', 'danger', 'critical'],
    })
      .notNull()
      .default('safe'),

    // "Financial Weather" summary
    weatherEmoji: text('weather_emoji'), // ☀️, 🌤️, ⛈️, etc.
    weatherSummary: text('weather_summary'), // Natural language summary

    // Recommendations (JSON array)
    recommendations: text('recommendations'),

    // Metadata
    generatedAt: integer('generated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    actualBalanceCents: integer('actual_balance_cents'), // Filled after the fact
  },
  (table) => ({
    dateIdx: index('forecast_date_idx').on(table.forecastDate),
  })
);

// Cash runway projections
export const cashRunway = sqliteTable(
  'cash_runway',
  {
    id: text('id').primaryKey(),

    // Current state
    currentBalanceCents: integer('current_balance_cents').notNull(),
    calculatedAt: integer('calculated_at').notNull(),

    // Runway metrics
    daysUntilZero: integer('days_until_zero'), // null if never
    zeroDate: text('zero_date'), // ISO date when balance hits zero

    // Burn rate
    dailyBurnRateCents: integer('daily_burn_rate_cents').notNull(),
    weeklyBurnRateCents: integer('weekly_burn_rate_cents').notNull(),

    // Upcoming obligations
    upcomingBillsCents: integer('upcoming_bills_cents').notNull(),
    upcomingBillsCount: integer('upcoming_bills_count').notNull(),

    // Safe to spend
    safeToSpendTodayCents: integer('safe_to_spend_today_cents').notNull(),
    safeToSpendWeekCents: integer('safe_to_spend_week_cents').notNull(),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    calculatedIdx: index('runway_calculated_idx').on(table.calculatedAt),
  })
);

// ============================================================================
// ALERTS - Smart notification system
// ============================================================================

export const alerts = sqliteTable(
  'alerts',
  {
    id: text('id').primaryKey(),

    // Alert type
    type: text('type', {
      enum: [
        'low_balance',
        'bill_due',
        'unusual_spending',
        'subscription_renewal',
        'debt_warning',
        'budget_exceeded',
        'goal_progress',
        'income_received',
        'duplicate_charge',
        'price_increase',
        'trial_ending',
        'savings_opportunity',
      ],
    }).notNull(),

    // Severity
    severity: text('severity', {
      enum: ['info', 'warning', 'urgent', 'critical'],
    }).notNull(),

    // Content
    title: text('title').notNull(),
    message: text('message').notNull(),

    // Related entities (JSON: { type: 'debt', id: 'xxx' })
    relatedEntity: text('related_entity'),

    // Actions (JSON array of action buttons)
    actions: text('actions'),

    // Status
    status: text('status', {
      enum: ['pending', 'sent', 'read', 'dismissed', 'actioned'],
    })
      .notNull()
      .default('pending'),

    // Scheduling
    scheduledFor: integer('scheduled_for'), // When to send
    sentAt: integer('sent_at'),
    readAt: integer('read_at'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    statusIdx: index('alert_status_idx').on(table.status),
    typeIdx: index('alert_type_idx').on(table.type),
    scheduledIdx: index('alert_scheduled_idx').on(table.scheduledFor),
  })
);

// ============================================================================
// GOALS - Financial goals tracking
// ============================================================================

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // Owner of this goal

    // Goal definition
    name: text('name').notNull(),
    description: text('description'),
    emoji: text('emoji'), // Visual identifier

    // Target
    targetAmountCents: integer('target_amount_cents').notNull(),
    currentAmountCents: integer('current_amount_cents').notNull().default(0),

    // Timeline
    targetDate: text('target_date'), // ISO date
    startDate: text('start_date').notNull(),

    // Type
    goalType: text('goal_type', {
      enum: [
        'savings',
        'debt_payoff',
        'purchase',
        'emergency_fund',
        'investment',
        'other',
      ],
    }).notNull(),

    // Linked entities
    linkedDebtId: text('linked_debt_id'), // For debt payoff goals
    linkedAccountId: text('linked_account_id'), // Savings account for this goal

    // Progress
    progressPercent: real('progress_percent').notNull().default(0),
    onTrack: integer('on_track', { mode: 'boolean' }).default(true),
    projectedCompletionDate: text('projected_completion_date'),

    // AI recommendations
    recommendedMonthlyCents: integer('recommended_monthly_cents'),

    // Status
    status: text('status', {
      enum: ['active', 'completed', 'paused', 'abandoned'],
    })
      .notNull()
      .default('active'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    completedAt: integer('completed_at'),
  },
  (table) => ({
    userIdx: index('goal_user_idx').on(table.userId),
    statusIdx: index('goal_status_idx').on(table.status),
    typeIdx: index('goal_type_idx').on(table.goalType),
  })
);

// ============================================================================
// DAILY SUMMARIES - AI-generated briefings
// ============================================================================

export const dailySummaries = sqliteTable(
  'daily_summaries',
  {
    id: text('id').primaryKey(),
    summaryDate: text('summary_date').notNull(), // ISO date

    // Financial weather
    weatherEmoji: text('weather_emoji').notNull(), // ☀️, 🌤️, 🌧️, ⛈️
    weatherHeadline: text('weather_headline').notNull(),

    // Key metrics
    currentBalanceCents: integer('current_balance_cents').notNull(),
    cashRunwayDays: integer('cash_runway_days'),
    safeToSpendCents: integer('safe_to_spend_cents'),

    // Yesterday's activity
    yesterdaySpentCents: integer('yesterday_spent_cents'),
    yesterdayEarnedCents: integer('yesterday_earned_cents'),

    // Upcoming
    billsDueCount: integer('bills_due_count').default(0),
    billsDueAmountCents: integer('bills_due_amount_cents').default(0),

    // AI-generated content (full summary text)
    summaryText: text('summary_text').notNull(),

    // Coaching tips (JSON array)
    coachingTips: text('coaching_tips'),

    // Warnings (JSON array)
    warnings: text('warnings'),

    // Opportunities (JSON array)
    opportunities: text('opportunities'),

    // Metadata
    generatedAt: integer('generated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    sentAt: integer('sent_at'),
    openedAt: integer('opened_at'),
  },
  (table) => ({
    dateIdx: index('summary_date_idx').on(table.summaryDate),
  })
);

// ============================================================================
// FILE UPLOADS - S3/R2 file storage and parsing
// ============================================================================

// Uploaded files stored in S3/R2
export const uploadedFiles = sqliteTable(
  'uploaded_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // File metadata
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(), // S3/R2 object key

    // Processing status
    status: text('status', {
      enum: ['stored', 'processing', 'processed', 'failed'],
    })
      .notNull()
      .default('stored'),
    failureReason: text('failure_reason'),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('uploaded_file_user_idx').on(table.userId),
    statusIdx: index('uploaded_file_status_idx').on(table.status),
    storageKeyIdx: uniqueIndex('uploaded_file_storage_key_idx').on(
      table.storageKey
    ),
  })
);

// Parsed summaries from uploaded files
export const fileParsedSummaries = sqliteTable(
  'file_parsed_summaries',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),

    // Parser metadata
    parserVersion: text('parser_version').notNull(), // e.g. 'v1'
    documentType: text('document_type', {
      enum: ['receipt', 'invoice', 'bank_statement', 'excel_table'],
    }).notNull(),

    // Parsed data (JSON string)
    summaryJson: text('summary_json').notNull(),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    fileIdx: index('parsed_summary_file_idx').on(table.fileId),
    versionIdx: index('parsed_summary_version_idx').on(table.parserVersion),
  })
);

// Tracks which parsed items have been imported as transactions
export const fileImportedItems = sqliteTable(
  'file_imported_items',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    parsedItemId: text('parsed_item_id').notNull(), // e.g. 'main', 'row_1'
    transactionId: text('transaction_id').notNull(),

    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    fileIdx: index('imported_item_file_idx').on(table.fileId),
    transactionIdx: index('imported_item_transaction_idx').on(
      table.transactionId
    ),
    uniqueImportIdx: uniqueIndex('imported_item_unique_idx').on(
      table.fileId,
      table.parsedItemId
    ),
  })
);

// ============================================================================
// INTERVIEW SESSIONS - AI-powered financial interview for onboarding
// ============================================================================

export const interviewSessions = sqliteTable(
  'interview_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Interview state
    status: text('status', {
      enum: ['in_progress', 'completed', 'abandoned'],
    })
      .notNull()
      .default('in_progress'),
    currentStep: text('current_step', {
      enum: [
        'cash',
        'income',
        'bills',
        'debts',
        'spending',
        'ant_expenses',
        'savings',
        'complete',
      ],
    })
      .notNull()
      .default('cash'),

    // Conversation history (JSON array of messages)
    conversationHistory: text('conversation_history'), // JSON: ChatMessage[]

    // Extracted data (JSON)
    extractedData: text('extracted_data'), // JSON: { cash: {...}, income: {...}, bills: [...], debts: [...], spending: {...}, ant_expenses: {...}, savings: {...} }

    // Insight flags for decision wall personalization
    insightFlags: text('insight_flags'), // JSON: ['overspend', 'no_buffer', 'ant_expenses_high', 'no_savings']

    // Uploaded files during interview
    uploadedFileIds: text('uploaded_file_ids'), // JSON: string[]

    // Timestamps
    startedAt: integer('started_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    completedAt: integer('completed_at'),
    lastActivityAt: integer('last_activity_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: uniqueIndex('interview_session_user_idx').on(table.userId),
    statusIdx: index('interview_session_status_idx').on(table.status),
  })
);

// ============================================================================
// SUBSCRIPTIONS & PAYMENTS - Pro/Premium plan tracking
// ============================================================================

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Plan info
    plan: text('plan', { enum: ['pro', 'premium'] }).notNull(),
    billingPeriod: text('billing_period', {
      enum: ['monthly', 'yearly'],
    }).notNull(),

    // Amount
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),

    // Payment provider info
    provider: text('provider', { enum: ['tilopay', 'stripe', 'manual'] })
      .notNull()
      .default('tilopay'),
    providerOrderNumber: text('provider_order_number'),
    providerTransactionId: text('provider_transaction_id'),
    providerAuth: text('provider_auth'),

    // Status
    status: text('status', {
      enum: ['pending', 'active', 'cancelled', 'expired', 'failed'],
    })
      .notNull()
      .default('pending'),

    // Dates
    startDate: integer('start_date'),
    endDate: integer('end_date'),

    // Timestamps
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('subscription_user_idx').on(table.userId),
    statusIdx: index('subscription_status_idx').on(table.status),
    orderIdx: uniqueIndex('subscription_order_idx').on(
      table.providerOrderNumber
    ),
  })
);

// ============================================================================
// ADVISOR SESSIONS - Financial advisor consultation history
// ============================================================================

export const advisorSessions = sqliteTable(
  'advisor_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Session state
    status: text('status', {
      enum: ['active', 'archived'],
    })
      .notNull()
      .default('active'),

    // Conversation history (JSON array of messages)
    conversationHistory: text('conversation_history'), // JSON: AdvisorMessage[]

    // Pending changes awaiting user confirmation (JSON)
    pendingChanges: text('pending_changes'), // JSON: PendingChange[]

    // Audit trail
    lastConfirmedAt: integer('last_confirmed_at'),
    lastDecisionRecompute: integer('last_decision_recompute'),

    // Timestamps
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    lastActivityAt: integer('last_activity_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('advisor_session_user_idx').on(table.userId),
    statusIdx: index('advisor_session_status_idx').on(table.status),
  })
);

// ============================================================================
// DECISION ENGINE - The core product
// ============================================================================

export const decisionState = sqliteTable(
  'decision_state',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Version tracking for debugging and A/B tests
    decisionVersion: text('decision_version').notNull(), // e.g., "v1.0.0"

    // Risk assessment
    riskLevel: text('risk_level', {
      enum: ['safe', 'caution', 'warning', 'danger', 'critical'],
    }).notNull(),

    // Primary command
    primaryCommandType: text('primary_command_type', {
      enum: ['pay', 'save', 'spend', 'freeze', 'wait'],
    }).notNull(),
    primaryCommandText: text('primary_command_text').notNull(),
    primaryCommandAmount: integer('primary_command_amount_cents'),
    primaryCommandTarget: text('primary_command_target'),
    primaryCommandDate: text('primary_command_date'),

    // Secondary warnings (max 2)
    warning1: text('warning_1'),
    warning2: text('warning_2'),

    // Next action
    nextActionText: text('next_action_text').notNull(),
    nextActionUrl: text('next_action_url').notNull(),

    // Internal basis for debugging (JSON - never shown to user)
    decisionBasisJson: text('decision_basis_json'),

    // Expiration and locking
    computedAt: integer('computed_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    expiresAt: integer('expires_at').notNull(),
    isLocked: integer('is_locked', { mode: 'boolean' })
      .notNull()
      .default(false),

    // User acknowledgment tracking
    acknowledgedAt: integer('acknowledged_at'),
  },
  (table) => ({
    userIdx: index('decision_state_user_idx').on(table.userId),
    expiresIdx: index('decision_state_expires_idx').on(table.expiresAt),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Decision Engine
export type DecisionState = typeof decisionState.$inferSelect;
export type NewDecisionState = typeof decisionState.$inferInsert;

// User authentication
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type EmailVerificationToken =
  typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken =
  typeof emailVerificationTokens.$inferInsert;

export type OAuthConnection = typeof oauthConnections.$inferSelect;
export type NewOAuthConnection = typeof oauthConnections.$inferInsert;

// Households
export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;

export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;

export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type NewHouseholdInvite = typeof householdInvites.$inferInsert;

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// Core entities
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Envelope = typeof envelopes.$inferSelect;
export type NewEnvelope = typeof envelopes.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Debt Copilot
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;

export type DebtPayment = typeof debtPayments.$inferSelect;
export type NewDebtPayment = typeof debtPayments.$inferInsert;

// Document processing
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

// Transaction inbox
export type TransactionInboxItem = typeof transactionInbox.$inferSelect;
export type NewTransactionInboxItem = typeof transactionInbox.$inferInsert;

// Category learning
export type CategoryPattern = typeof categoryPatterns.$inferSelect;
export type NewCategoryPattern = typeof categoryPatterns.$inferInsert;

// Recurring transactions
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;

// Behavior model
export type SpendingPattern = typeof spendingPatterns.$inferSelect;
export type NewSpendingPattern = typeof spendingPatterns.$inferInsert;

export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type NewMonthlySnapshot = typeof monthlySnapshots.$inferInsert;

// Predictions
export type DailyForecast = typeof dailyForecasts.$inferSelect;
export type NewDailyForecast = typeof dailyForecasts.$inferInsert;

export type CashRunway = typeof cashRunway.$inferSelect;
export type NewCashRunway = typeof cashRunway.$inferInsert;

// Alerts
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

// Goals
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;

// Daily summaries
export type DailySummary = typeof dailySummaries.$inferSelect;
export type NewDailySummary = typeof dailySummaries.$inferInsert;

// File uploads
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type NewUploadedFile = typeof uploadedFiles.$inferInsert;

export type FileParsedSummary = typeof fileParsedSummaries.$inferSelect;
export type NewFileParsedSummary = typeof fileParsedSummaries.$inferInsert;

export type FileImportedItem = typeof fileImportedItems.$inferSelect;
export type NewFileImportedItem = typeof fileImportedItems.$inferInsert;

// Interview sessions
export type InterviewSession = typeof interviewSessions.$inferSelect;
export type NewInterviewSession = typeof interviewSessions.$inferInsert;

// Subscriptions
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

// Advisor sessions
export type AdvisorSession = typeof advisorSessions.$inferSelect;
export type NewAdvisorSession = typeof advisorSessions.$inferInsert;
