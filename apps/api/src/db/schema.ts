import {
  pgTable,
  pgEnum,
  text,
  bigint,
  real,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Database schema for Budget Copilot - The Money Brain™
 * A comprehensive personal finance AI system
 * Using PostgreSQL via drizzle-orm/pg-core
 */

// ============================================================================
// ENUMS
// ============================================================================

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'suspended',
  'deleted',
]);
export const userRoleEnum = pgEnum('user_role', [
  'user',
  'admin',
  'superadmin',
]);
export const userPlanEnum = pgEnum('user_plan', ['free', 'pro', 'premium']);
export const deviceTypeEnum = pgEnum('device_type', [
  'web',
  'mobile',
  'desktop',
]);
export const householdMemberRoleEnum = pgEnum('household_member_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);
export const householdInviteRoleEnum = pgEnum('household_invite_role', [
  'admin',
  'member',
  'viewer',
]);
export const oauthProviderEnum = pgEnum('oauth_provider', [
  'google',
  'apple',
  'github',
]);
export const payFrequencyEnum = pgEnum('pay_frequency', [
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
]);
export const copilotToneEnum = pgEnum('copilot_tone', [
  'friendly',
  'sassy',
  'strict',
  'gentle',
]);
export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'credit',
  'cash',
]);
export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',
  'expense',
]);
export const debtTypeEnum = pgEnum('debt_type', [
  'credit_card',
  'personal_loan',
  'auto_loan',
  'mortgage',
  'student_loan',
  'medical',
  'other',
]);
export const debtStatusEnum = pgEnum('debt_status', [
  'active',
  'paid_off',
  'defaulted',
  'deferred',
]);
export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);
export const documentSourceTypeEnum = pgEnum('document_source_type', [
  'screenshot',
  'pdf_statement',
  'receipt',
  'email_attachment',
  'manual_upload',
]);
export const inboxStatusEnum = pgEnum('inbox_status', [
  'pending',
  'approved',
  'rejected',
  'merged',
]);
export const patternTypeEnum = pgEnum('pattern_type', [
  'merchant',
  'keyword',
  'amount_range',
  'description_regex',
]);
export const learnedFromEnum = pgEnum('learned_from', [
  'user_action',
  'ai_suggestion',
  'manual_rule',
]);
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annually',
]);
export const detectionMethodEnum = pgEnum('detection_method', [
  'ai_detected',
  'user_created',
  'email_parsed',
]);
export const recurringStatusEnum = pgEnum('recurring_status', [
  'active',
  'paused',
  'cancelled',
  'trial',
]);
// Shared between dailyForecasts.cashflowRisk and decisionState.riskLevel
export const riskLevelEnum = pgEnum('risk_level', [
  'safe',
  'caution',
  'warning',
  'danger',
  'critical',
]);
export const alertTypeEnum = pgEnum('alert_type', [
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
]);
export const alertSeverityEnum = pgEnum('alert_severity', [
  'info',
  'warning',
  'urgent',
  'critical',
]);
export const alertStatusEnum = pgEnum('alert_status', [
  'pending',
  'sent',
  'read',
  'dismissed',
  'actioned',
]);
export const goalTypeEnum = pgEnum('goal_type', [
  'savings',
  'debt_payoff',
  'purchase',
  'emergency_fund',
  'investment',
  'other',
]);
export const goalStatusEnum = pgEnum('goal_status', [
  'active',
  'completed',
  'paused',
  'abandoned',
]);
export const uploadedFileStatusEnum = pgEnum('uploaded_file_status', [
  'stored',
  'processing',
  'processed',
  'failed',
]);
export const parsedDocumentTypeEnum = pgEnum('parsed_document_type', [
  'receipt',
  'invoice',
  'bank_statement',
  'excel_table',
]);
export const interviewStatusEnum = pgEnum('interview_status', [
  'in_progress',
  'completed',
  'abandoned',
]);
export const interviewStepEnum = pgEnum('interview_step', [
  'cash',
  'income',
  'bills',
  'debts',
  'spending',
  'ant_expenses',
  'savings',
  'complete',
]);
export const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'pro',
  'premium',
]);
export const billingPeriodEnum = pgEnum('billing_period', [
  'monthly',
  'yearly',
]);
export const paymentProviderEnum = pgEnum('payment_provider', [
  'tilopay',
  'stripe',
  'manual',
]);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'pending',
  'active',
  'cancelled',
  'expired',
  'failed',
]);
export const advisorSessionStatusEnum = pgEnum('advisor_session_status', [
  'active',
  'archived',
]);
export const primaryCommandTypeEnum = pgEnum('primary_command_type', [
  'pay',
  'save',
  'spend',
  'freeze',
  'wait',
]);

// ============================================================================
// USER AUTHENTICATION & IDENTITY
// ============================================================================

// Users table - core authentication
export const users = pgTable(
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
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: bigint('email_verified_at', { mode: 'number' }),

    // Account status
    status: userStatusEnum('status').notNull().default('active'),
    role: userRoleEnum('role').notNull().default('user'),

    // Preferences (JSON)
    preferences: text('preferences'), // { currency: 'USD', language: 'es', timezone: 'America/Panama' }

    // Subscription/Plan
    plan: userPlanEnum('plan').notNull().default('free'),
    planExpiresAt: bigint('plan_expires_at', { mode: 'number' }),

    // Timestamps
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    lastLoginAt: bigint('last_login_at', { mode: 'number' }),
  },
  (table) => [
    uniqueIndex('user_email_idx').on(table.email),
    index('user_status_idx').on(table.status),
  ]
);

// Sessions - token-based auth sessions
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Token
    token: text('token').notNull(),

    // Device info
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    deviceType: deviceTypeEnum('device_type'),

    // Expiration
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),

    // Status
    isValid: boolean('is_valid').notNull().default(true),
    revokedAt: bigint('revoked_at', { mode: 'number' }),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    uniqueIndex('session_token_idx').on(table.token),
    index('session_user_idx').on(table.userId),
    index('session_expires_idx').on(table.expiresAt),
  ]
);

// Password reset tokens
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    token: text('token').notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),

    usedAt: bigint('used_at', { mode: 'number' }),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    uniqueIndex('password_reset_token_idx').on(table.token),
    index('password_reset_user_idx').on(table.userId),
  ]
);

// Email verification tokens
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    token: text('token').notNull(),
    email: text('email').notNull(), // The email being verified
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),

    usedAt: bigint('used_at', { mode: 'number' }),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    uniqueIndex('email_verification_token_idx').on(table.token),
    index('email_verification_user_idx').on(table.userId),
  ]
);

// ============================================================================
// HOUSEHOLDS - Family sharing
// ============================================================================

// Households table - family/group sharing
export const households = pgTable(
  'households',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    inviteCode: text('invite_code'), // Optional static invite code
    createdById: text('created_by_id').notNull(),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    uniqueIndex('household_invite_code_idx').on(table.inviteCode),
    index('household_created_by_idx').on(table.createdById),
  ]
);

// Household members - links users to households
export const householdMembers = pgTable(
  'household_members',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    userId: text('user_id'),
    name: text('name'),
    role: householdMemberRoleEnum('role').notNull().default('member'),
    invitedAt: bigint('invited_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    acceptedAt: bigint('accepted_at', { mode: 'number' }),
  },
  (table) => [
    index('household_member_household_idx').on(table.householdId),
    index('household_member_user_idx').on(table.userId),
  ]
);

// Household invites - pending invitations
export const householdInvites = pgTable(
  'household_invites',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    email: text('email'), // Optional - if null, anyone with link can join
    token: text('token').notNull(),
    role: householdInviteRoleEnum('role').notNull().default('member'),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    usedAt: bigint('used_at', { mode: 'number' }),
    createdById: text('created_by_id').notNull(),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    uniqueIndex('household_invite_token_idx').on(table.token),
    index('household_invite_household_idx').on(table.householdId),
    index('household_invite_email_idx').on(table.email),
  ]
);

// OAuth connections (for future Google/Apple login)
export const oauthConnections = pgTable(
  'oauth_connections',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    provider: oauthProviderEnum('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),

    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: bigint('expires_at', { mode: 'number' }),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('oauth_user_idx').on(table.userId),
    uniqueIndex('oauth_provider_idx').on(table.provider, table.providerUserId),
  ]
);

// ============================================================================
// USER FINANCIAL PROFILE - Onboarding and financial info
// ============================================================================

// User financial profile - stores salary, pay frequency, etc.
export const userProfiles = pgTable(
  'user_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Onboarding status
    onboardingCompleted: boolean('onboarding_completed')
      .notNull()
      .default(false),
    onboardingStep: bigint('onboarding_step', { mode: 'number' })
      .notNull()
      .default(0), // 0=not started, 1=salary, 2=frequency, 3=debts, etc.

    // Income info
    monthlySalaryCents: bigint('monthly_salary_cents', { mode: 'number' }),
    payFrequency: payFrequencyEnum('pay_frequency'),
    nextPayday: text('next_payday'), // ISO date

    // Financial goals
    monthlySavingsGoalCents: bigint('monthly_savings_goal_cents', {
      mode: 'number',
    }),
    emergencyFundGoalCents: bigint('emergency_fund_goal_cents', {
      mode: 'number',
    }),

    // Spending limits
    dailySpendingLimitCents: bigint('daily_spending_limit_cents', {
      mode: 'number',
    }),
    weeklySpendingLimitCents: bigint('weekly_spending_limit_cents', {
      mode: 'number',
    }),

    // Copilot preferences
    copilotTone: copilotToneEnum('copilot_tone').default('sassy'),
    receiveProactiveTips: boolean('receive_proactive_tips').default(true),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [uniqueIndex('user_profile_user_idx').on(table.userId)]
);

// ============================================================================
// CORE FINANCIAL ENTITIES
// ============================================================================

// Accounts table
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // Owner of this account
    name: text('name').notNull(),
    institution: text('institution'),
    type: accountTypeEnum('type').notNull(),
    currentBalanceCents: bigint('current_balance_cents', {
      mode: 'number',
    }).default(0),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('account_user_idx').on(table.userId)]
);

// Categories table with hierarchical support
export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // Owner of this category
    name: text('name').notNull(),
    parentId: text('parent_id'),
    emoji: text('emoji'), // Optional emoji icon
    color: text('color'), // Optional hex color
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('category_user_idx').on(table.userId)]
);

// Envelopes table (monthly budgets per category)
export const envelopes = pgTable(
  'envelopes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id').notNull(),
    month: text('month').notNull(), // YYYY-MM format
    budgetCents: bigint('budget_cents', { mode: 'number' }).notNull(), // Amount in cents
    spentCents: bigint('spent_cents', { mode: 'number' }).notNull().default(0), // Track spending
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('envelope_user_idx').on(table.userId),
    index('envelope_month_category_idx').on(table.month, table.categoryId),
  ]
);

// Transactions table
export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    date: text('date').notNull(), // ISO date string YYYY-MM-DD
    description: text('description').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(), // Positive for income, negative for expense
    type: transactionTypeEnum('type').notNull(),
    categoryId: text('category_id'),
    accountId: text('account_id').notNull(),
    cleared: boolean('cleared').notNull().default(false),
    notes: text('notes'),
    sensitive: boolean('sensitive').notNull().default(false),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('transaction_user_idx').on(table.userId),
    index('transaction_date_idx').on(table.date),
    index('transaction_category_idx').on(table.categoryId),
    index('transaction_account_idx').on(table.accountId),
  ]
);

// ============================================================================
// DEBT COPILOT - Debt tracking and payoff projections
// ============================================================================

// Debts table - credit cards, loans, mortgages, etc.
export const debts = pgTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(), // "Chase Sapphire", "Car Loan", etc.
    type: debtTypeEnum('type').notNull(),
    accountId: text('account_id'), // Link to account if applicable

    // Balance tracking
    originalBalanceCents: bigint('original_balance_cents', {
      mode: 'number',
    }).notNull(),
    currentBalanceCents: bigint('current_balance_cents', {
      mode: 'number',
    }).notNull(),

    // Interest and terms
    aprPercent: real('apr_percent').notNull(), // Annual percentage rate
    minimumPaymentCents: bigint('minimum_payment_cents', { mode: 'number' }),
    termMonths: bigint('term_months', { mode: 'number' }), // Loan duration in months (null for revolving credit like credit cards)
    startDate: text('start_date'), // ISO date when loan was originated (optional)

    // Due dates
    dueDay: bigint('due_day', { mode: 'number' }), // Day of month (1-31)
    nextDueDate: text('next_due_date'), // ISO date

    // Status
    status: debtStatusEnum('status').notNull().default('active'),

    // AI-computed fields
    deathDate: text('death_date'), // Projected payoff date at current rate
    totalInterestProjectedCents: bigint('total_interest_projected_cents', {
      mode: 'number',
    }),
    dangerScore: bigint('danger_score', { mode: 'number' }), // 0-100, how much this debt threatens cashflow

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('debt_status_idx').on(table.status),
    index('debt_danger_idx').on(table.dangerScore),
  ]
);

// Debt payment history
export const debtPayments = pgTable(
  'debt_payments',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    transactionId: text('transaction_id'), // Link to transaction if imported

    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    principalCents: bigint('principal_cents', { mode: 'number' }), // Portion going to principal
    interestCents: bigint('interest_cents', { mode: 'number' }), // Portion going to interest

    paymentDate: text('payment_date').notNull(), // ISO date

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('debt_payment_debt_idx').on(table.debtId),
    index('debt_payment_date_idx').on(table.paymentDate),
  ]
);

// ============================================================================
// DOCUMENT PROCESSING - Screenshot/PDF parsing
// ============================================================================

// Uploaded documents (screenshots, PDFs, statements)
export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),

    // File info
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    filePath: text('file_path').notNull(), // Local storage path
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),

    // Processing status
    status: documentStatusEnum('status').notNull().default('pending'),

    // Source type
    sourceType: documentSourceTypeEnum('source_type').notNull(),

    // AI extraction results
    extractedData: text('extracted_data'), // JSON blob of parsed data
    extractionConfidence: real('extraction_confidence'), // 0-1 confidence score

    // Processing metadata
    processedAt: bigint('processed_at', { mode: 'number' }),
    errorMessage: text('error_message'),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('document_status_idx').on(table.status),
    index('document_source_idx').on(table.sourceType),
  ]
);

// ============================================================================
// TRANSACTION INBOX - Swipe-to-categorize system
// ============================================================================

// Pending transactions awaiting user review
export const transactionInbox = pgTable(
  'transaction_inbox',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id'), // Source document if from upload

    // Raw extracted data
    rawDescription: text('raw_description').notNull(),
    rawAmountCents: bigint('raw_amount_cents', { mode: 'number' }).notNull(),
    rawDate: text('raw_date'), // ISO date, may be missing
    rawMerchant: text('raw_merchant'),

    // AI suggestions
    suggestedCategoryId: text('suggested_category_id'),
    suggestedAccountId: text('suggested_account_id'),
    suggestionConfidence: real('suggestion_confidence'), // 0-1

    // Status
    status: inboxStatusEnum('status').notNull().default('pending'),

    // If approved, link to created transaction
    approvedTransactionId: text('approved_transaction_id'),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    reviewedAt: bigint('reviewed_at', { mode: 'number' }),
  },
  (table) => [
    index('inbox_status_idx').on(table.status),
    index('inbox_document_idx').on(table.documentId),
  ]
);

// ============================================================================
// CATEGORY LEARNING - Auto-categorization AI
// ============================================================================

// Category learning patterns - AI learns from user categorizations
export const categoryPatterns = pgTable(
  'category_patterns',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id').notNull(),

    // Pattern matching
    patternType: patternTypeEnum('pattern_type').notNull(),
    patternValue: text('pattern_value').notNull(), // The actual pattern

    // Learning metrics
    matchCount: bigint('match_count', { mode: 'number' }).notNull().default(0),
    confidence: real('confidence').notNull().default(0.5), // Grows with successful matches

    // Source
    learnedFrom: learnedFromEnum('learned_from').notNull(),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('pattern_category_idx').on(table.categoryId),
    index('pattern_type_value_idx').on(table.patternType, table.patternValue),
  ]
);

// ============================================================================
// RECURRING TRANSACTIONS - Subscriptions and bills
// ============================================================================

// Detected recurring transactions (subscriptions, bills, income)
export const recurringTransactions = pgTable(
  'recurring_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Description
    name: text('name').notNull(), // "Netflix", "Rent", "Salary"
    description: text('description'),

    // Amount (can vary for some bills)
    expectedAmountCents: bigint('expected_amount_cents', {
      mode: 'number',
    }).notNull(),
    amountVariancePercent: real('amount_variance_percent').default(0), // Allowed variance

    // Frequency
    frequency: recurrenceFrequencyEnum('frequency').notNull(),
    dayOfMonth: bigint('day_of_month', { mode: 'number' }), // For monthly
    dayOfWeek: bigint('day_of_week', { mode: 'number' }), // For weekly (0=Sun, 6=Sat)

    // Type
    type: transactionTypeEnum('type').notNull(),
    isSubscription: boolean('is_subscription').default(false),

    // Categorization
    categoryId: text('category_id'),
    accountId: text('account_id'),

    // Detection
    detectionMethod: detectionMethodEnum('detection_method').notNull(),
    confidence: real('confidence').default(1.0),

    // Status
    status: recurringStatusEnum('status').notNull().default('active'),

    // Dates
    nextExpectedDate: text('next_expected_date'), // ISO date
    lastSeenDate: text('last_seen_date'), // ISO date
    trialEndsDate: text('trial_ends_date'), // For subscription trials

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('recurring_status_idx').on(table.status),
    index('recurring_type_idx').on(table.type),
    index('recurring_next_date_idx').on(table.nextExpectedDate),
  ]
);

// ============================================================================
// BEHAVIOR MODEL - The Money Brain™ behavioral intelligence
// ============================================================================

// Daily spending patterns
export const spendingPatterns = pgTable(
  'spending_patterns',
  {
    id: text('id').primaryKey(),

    // Time dimension
    dayOfWeek: bigint('day_of_week', { mode: 'number' }).notNull(), // 0=Sun, 6=Sat
    weekOfMonth: bigint('week_of_month', { mode: 'number' }), // 1-5

    // Aggregated metrics
    avgSpendingCents: bigint('avg_spending_cents', {
      mode: 'number',
    }).notNull(),
    medianSpendingCents: bigint('median_spending_cents', { mode: 'number' }),
    maxSpendingCents: bigint('max_spending_cents', { mode: 'number' }),

    // Behavior flags
    isDangerDay: boolean('is_danger_day').default(false),
    overspendProbability: real('overspend_probability').default(0), // 0-1

    // Category breakdown (JSON: { categoryId: avgCents })
    categoryBreakdown: text('category_breakdown'),

    // Sample size
    sampleCount: bigint('sample_count', { mode: 'number' })
      .notNull()
      .default(0),

    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('pattern_day_idx').on(table.dayOfWeek)]
);

// Monthly behavior snapshots
export const monthlySnapshots = pgTable(
  'monthly_snapshots',
  {
    id: text('id').primaryKey(),
    month: text('month').notNull(), // YYYY-MM format

    // Income metrics
    totalIncomeCents: bigint('total_income_cents', { mode: 'number' })
      .notNull()
      .default(0),
    incomeVariancePercent: real('income_variance_percent'), // vs average

    // Spending metrics
    totalSpendingCents: bigint('total_spending_cents', { mode: 'number' })
      .notNull()
      .default(0),
    spendingVariancePercent: real('spending_variance_percent'), // vs average

    // Savings
    netSavingsCents: bigint('net_savings_cents', { mode: 'number' })
      .notNull()
      .default(0),
    savingsRatePercent: real('savings_rate_percent'),

    // Category breakdown (JSON)
    categoryTotals: text('category_totals'),

    // Behavioral metrics
    dangerDaysCount: bigint('danger_days_count', { mode: 'number' }).default(0),
    overspendDaysCount: bigint('overspend_days_count', {
      mode: 'number',
    }).default(0),

    // AI insights (JSON array of insight objects)
    aiInsights: text('ai_insights'),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('snapshot_month_idx').on(table.month)]
);

// ============================================================================
// PREDICTIONS & FORECASTS - Financial weather system
// ============================================================================

// Daily financial forecasts
export const dailyForecasts = pgTable(
  'daily_forecasts',
  {
    id: text('id').primaryKey(),
    forecastDate: text('forecast_date').notNull(), // ISO date being forecasted

    // Balance predictions
    predictedBalanceCents: bigint('predicted_balance_cents', {
      mode: 'number',
    }).notNull(),
    confidenceInterval: bigint('confidence_interval_cents', { mode: 'number' }), // +/- this amount

    // Expected events
    expectedIncomeCents: bigint('expected_income_cents', {
      mode: 'number',
    }).default(0),
    expectedExpensesCents: bigint('expected_expenses_cents', {
      mode: 'number',
    }).default(0),
    expectedBillsCents: bigint('expected_bills_cents', {
      mode: 'number',
    }).default(0),

    // Risk assessment
    cashflowRisk: riskLevelEnum('cashflow_risk').notNull().default('safe'),

    // "Financial Weather" summary
    weatherEmoji: text('weather_emoji'), // ☀️, 🌤️, ⛈️, etc.
    weatherSummary: text('weather_summary'), // Natural language summary

    // Recommendations (JSON array)
    recommendations: text('recommendations'),

    // Metadata
    generatedAt: bigint('generated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    actualBalanceCents: bigint('actual_balance_cents', { mode: 'number' }), // Filled after the fact
  },
  (table) => [index('forecast_date_idx').on(table.forecastDate)]
);

// Cash runway projections
export const cashRunway = pgTable(
  'cash_runway',
  {
    id: text('id').primaryKey(),

    // Current state
    currentBalanceCents: bigint('current_balance_cents', {
      mode: 'number',
    }).notNull(),
    calculatedAt: bigint('calculated_at', { mode: 'number' }).notNull(),

    // Runway metrics
    daysUntilZero: bigint('days_until_zero', { mode: 'number' }), // null if never
    zeroDate: text('zero_date'), // ISO date when balance hits zero

    // Burn rate
    dailyBurnRateCents: bigint('daily_burn_rate_cents', {
      mode: 'number',
    }).notNull(),
    weeklyBurnRateCents: bigint('weekly_burn_rate_cents', {
      mode: 'number',
    }).notNull(),

    // Upcoming obligations
    upcomingBillsCents: bigint('upcoming_bills_cents', {
      mode: 'number',
    }).notNull(),
    upcomingBillsCount: bigint('upcoming_bills_count', {
      mode: 'number',
    }).notNull(),

    // Safe to spend
    safeToSpendTodayCents: bigint('safe_to_spend_today_cents', {
      mode: 'number',
    }).notNull(),
    safeToSpendWeekCents: bigint('safe_to_spend_week_cents', {
      mode: 'number',
    }).notNull(),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('runway_calculated_idx').on(table.calculatedAt)]
);

// ============================================================================
// ALERTS - Smart notification system
// ============================================================================

export const alerts = pgTable(
  'alerts',
  {
    id: text('id').primaryKey(),

    // Alert type
    type: alertTypeEnum('type').notNull(),

    // Severity
    severity: alertSeverityEnum('severity').notNull(),

    // Content
    title: text('title').notNull(),
    message: text('message').notNull(),

    // Related entities (JSON: { type: 'debt', id: 'xxx' })
    relatedEntity: text('related_entity'),

    // Actions (JSON array of action buttons)
    actions: text('actions'),

    // Status
    status: alertStatusEnum('status').notNull().default('pending'),

    // Scheduling
    scheduledFor: bigint('scheduled_for', { mode: 'number' }), // When to send
    sentAt: bigint('sent_at', { mode: 'number' }),
    readAt: bigint('read_at', { mode: 'number' }),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('alert_status_idx').on(table.status),
    index('alert_type_idx').on(table.type),
    index('alert_scheduled_idx').on(table.scheduledFor),
  ]
);

// ============================================================================
// GOALS - Financial goals tracking
// ============================================================================

export const goals = pgTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // Owner of this goal

    // Goal definition
    name: text('name').notNull(),
    description: text('description'),
    emoji: text('emoji'), // Visual identifier

    // Target
    targetAmountCents: bigint('target_amount_cents', {
      mode: 'number',
    }).notNull(),
    currentAmountCents: bigint('current_amount_cents', { mode: 'number' })
      .notNull()
      .default(0),

    // Timeline
    targetDate: text('target_date'), // ISO date
    startDate: text('start_date').notNull(),

    // Type
    goalType: goalTypeEnum('goal_type').notNull(),

    // Linked entities
    linkedDebtId: text('linked_debt_id'), // For debt payoff goals
    linkedAccountId: text('linked_account_id'), // Savings account for this goal

    // Progress
    progressPercent: real('progress_percent').notNull().default(0),
    onTrack: boolean('on_track').default(true),
    projectedCompletionDate: text('projected_completion_date'),

    // AI recommendations
    recommendedMonthlyCents: bigint('recommended_monthly_cents', {
      mode: 'number',
    }),

    // Status
    status: goalStatusEnum('status').notNull().default('active'),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    completedAt: bigint('completed_at', { mode: 'number' }),
  },
  (table) => [
    index('goal_user_idx').on(table.userId),
    index('goal_status_idx').on(table.status),
    index('goal_type_idx').on(table.goalType),
  ]
);

// ============================================================================
// DAILY SUMMARIES - AI-generated briefings
// ============================================================================

export const dailySummaries = pgTable(
  'daily_summaries',
  {
    id: text('id').primaryKey(),
    summaryDate: text('summary_date').notNull(), // ISO date

    // Financial weather
    weatherEmoji: text('weather_emoji').notNull(), // ☀️, 🌤️, 🌧️, ⛈️
    weatherHeadline: text('weather_headline').notNull(),

    // Key metrics
    currentBalanceCents: bigint('current_balance_cents', {
      mode: 'number',
    }).notNull(),
    cashRunwayDays: bigint('cash_runway_days', { mode: 'number' }),
    safeToSpendCents: bigint('safe_to_spend_cents', { mode: 'number' }),

    // Yesterday's activity
    yesterdaySpentCents: bigint('yesterday_spent_cents', { mode: 'number' }),
    yesterdayEarnedCents: bigint('yesterday_earned_cents', { mode: 'number' }),

    // Upcoming
    billsDueCount: bigint('bills_due_count', { mode: 'number' }).default(0),
    billsDueAmountCents: bigint('bills_due_amount_cents', {
      mode: 'number',
    }).default(0),

    // AI-generated content (full summary text)
    summaryText: text('summary_text').notNull(),

    // Coaching tips (JSON array)
    coachingTips: text('coaching_tips'),

    // Warnings (JSON array)
    warnings: text('warnings'),

    // Opportunities (JSON array)
    opportunities: text('opportunities'),

    // Metadata
    generatedAt: bigint('generated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    sentAt: bigint('sent_at', { mode: 'number' }),
    openedAt: bigint('opened_at', { mode: 'number' }),
  },
  (table) => [index('summary_date_idx').on(table.summaryDate)]
);

// ============================================================================
// FILE UPLOADS - S3/R2 file storage and parsing
// ============================================================================

// Uploaded files stored in S3/R2
export const uploadedFiles = pgTable(
  'uploaded_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // File metadata
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(), // S3/R2 object key

    // Processing status
    status: uploadedFileStatusEnum('status').notNull().default('stored'),
    failureReason: text('failure_reason'),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('uploaded_file_user_idx').on(table.userId),
    index('uploaded_file_status_idx').on(table.status),
    uniqueIndex('uploaded_file_storage_key_idx').on(table.storageKey),
  ]
);

// Parsed summaries from uploaded files
export const fileParsedSummaries = pgTable(
  'file_parsed_summaries',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),

    // Parser metadata
    parserVersion: text('parser_version').notNull(), // e.g. 'v1'
    documentType: parsedDocumentTypeEnum('document_type').notNull(),

    // Parsed data (JSON string)
    summaryJson: text('summary_json').notNull(),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('parsed_summary_file_idx').on(table.fileId),
    index('parsed_summary_version_idx').on(table.parserVersion),
  ]
);

// Tracks which parsed items have been imported as transactions
export const fileImportedItems = pgTable(
  'file_imported_items',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    parsedItemId: text('parsed_item_id').notNull(), // e.g. 'main', 'row_1'
    transactionId: text('transaction_id').notNull(),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('imported_item_file_idx').on(table.fileId),
    index('imported_item_transaction_idx').on(table.transactionId),
    uniqueIndex('imported_item_unique_idx').on(
      table.fileId,
      table.parsedItemId
    ),
  ]
);

// ============================================================================
// INTERVIEW SESSIONS - AI-powered financial interview for onboarding
// ============================================================================

export const interviewSessions = pgTable(
  'interview_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Interview state
    status: interviewStatusEnum('status').notNull().default('in_progress'),
    currentStep: interviewStepEnum('current_step').notNull().default('cash'),

    // Conversation history (JSON array of messages)
    conversationHistory: text('conversation_history'), // JSON: ChatMessage[]

    // Extracted data (JSON)
    extractedData: text('extracted_data'), // JSON: { cash: {...}, income: {...}, bills: [...], debts: [...], spending: {...}, ant_expenses: {...}, savings: {...} }

    // Insight flags for decision wall personalization
    insightFlags: text('insight_flags'), // JSON: ['overspend', 'no_buffer', 'ant_expenses_high', 'no_savings']

    // Uploaded files during interview
    uploadedFileIds: text('uploaded_file_ids'), // JSON: string[]

    // Timestamps
    startedAt: bigint('started_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    completedAt: bigint('completed_at', { mode: 'number' }),
    lastActivityAt: bigint('last_activity_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    uniqueIndex('interview_session_user_idx').on(table.userId),
    index('interview_session_status_idx').on(table.status),
  ]
);

// ============================================================================
// SUBSCRIPTIONS & PAYMENTS - Pro/Premium plan tracking
// ============================================================================

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Plan info
    plan: subscriptionPlanEnum('plan').notNull(),
    billingPeriod: billingPeriodEnum('billing_period').notNull(),

    // Amount
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('USD'),

    // Payment provider info
    provider: paymentProviderEnum('provider').notNull().default('tilopay'),
    providerOrderNumber: text('provider_order_number'),
    providerTransactionId: text('provider_transaction_id'),
    providerAuth: text('provider_auth'),

    // Status
    status: subscriptionStatusEnum('status').notNull().default('pending'),

    // Dates
    startDate: bigint('start_date', { mode: 'number' }),
    endDate: bigint('end_date', { mode: 'number' }),

    // Timestamps
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('subscription_user_idx').on(table.userId),
    index('subscription_status_idx').on(table.status),
    uniqueIndex('subscription_order_idx').on(table.providerOrderNumber),
  ]
);

// ============================================================================
// ADVISOR SESSIONS - Financial advisor consultation history
// ============================================================================

export const advisorSessions = pgTable(
  'advisor_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Session state
    status: advisorSessionStatusEnum('status').notNull().default('active'),

    // Conversation history (JSON array of messages)
    conversationHistory: text('conversation_history'), // JSON: AdvisorMessage[]

    // Pending changes awaiting user confirmation (JSON)
    pendingChanges: text('pending_changes'), // JSON: PendingChange[]

    // Audit trail
    lastConfirmedAt: bigint('last_confirmed_at', { mode: 'number' }),
    lastDecisionRecompute: bigint('last_decision_recompute', {
      mode: 'number',
    }),

    // Timestamps
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    lastActivityAt: bigint('last_activity_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('advisor_session_user_idx').on(table.userId),
    index('advisor_session_status_idx').on(table.status),
  ]
);

// ============================================================================
// DECISION ENGINE - The core product
// ============================================================================

export const decisionState = pgTable(
  'decision_state',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Version tracking for debugging and A/B tests
    decisionVersion: text('decision_version').notNull(), // e.g., "v1.0.0"

    // Risk assessment
    riskLevel: riskLevelEnum('risk_level').notNull(),

    // Primary command
    primaryCommandType: primaryCommandTypeEnum(
      'primary_command_type'
    ).notNull(),
    primaryCommandText: text('primary_command_text').notNull(),
    primaryCommandAmount: bigint('primary_command_amount_cents', {
      mode: 'number',
    }),
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
    computedAt: bigint('computed_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    isLocked: boolean('is_locked').notNull().default(false),

    // User acknowledgment tracking
    acknowledgedAt: bigint('acknowledged_at', { mode: 'number' }),
  },
  (table) => [
    index('decision_state_user_idx').on(table.userId),
    index('decision_state_expires_idx').on(table.expiresAt),
  ]
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
