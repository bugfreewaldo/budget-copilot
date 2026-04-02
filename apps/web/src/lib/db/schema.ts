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
 * Database schema for Budget Copilot
 * Shared schema for both API and Web serverless functions
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
export const minimumPaymentTypeEnum = pgEnum('minimum_payment_type', [
  'fixed',
  'percent',
]);
export const debtStatusEnum = pgEnum('debt_status', [
  'active',
  'paid_off',
  'defaulted',
  'deferred',
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
export const billTypeEnum = pgEnum('bill_type', [
  'mortgage',
  'rent',
  'auto_loan',
  'credit_card',
  'personal_loan',
  'student_loan',
  'utility',
  'insurance',
  'subscription',
  'other',
]);
export const billFrequencyEnum = pgEnum('bill_frequency', [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annually',
]);
export const billStatusEnum = pgEnum('bill_status', [
  'active',
  'paused',
  'completed',
]);
export const incomeSourceEnum = pgEnum('income_source', [
  'salary',
  'freelance',
  'business',
  'investment',
  'rental',
  'side_hustle',
  'bonus',
  'other',
]);
export const incomeStatusEnum = pgEnum('income_status', [
  'active',
  'paused',
  'ended',
]);
export const fileStatusEnum = pgEnum('file_status', [
  'stored',
  'processing',
  'processed',
  'failed',
]);
export const documentTypeEnum = pgEnum('document_type', [
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
export const riskLevelEnum = pgEnum('risk_level', [
  'safe',
  'caution',
  'warning',
  'danger',
  'critical',
]);
export const commandTypeEnum = pgEnum('command_type', [
  'pay',
  'save',
  'spend',
  'freeze',
  'wait',
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

// ============================================================================
// USER AUTHENTICATION & IDENTITY
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: bigint('email_verified_at', { mode: 'number' }),
    status: userStatusEnum('status').notNull().default('active'),
    role: userRoleEnum('role').notNull().default('user'),
    preferences: text('preferences'),
    plan: userPlanEnum('plan').notNull().default('free'),
    planExpiresAt: bigint('plan_expires_at', { mode: 'number' }),
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

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    token: text('token').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    deviceType: deviceTypeEnum('device_type'),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
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

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    token: text('token').notNull(),
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
// HOUSEHOLDS (FAMILY SHARING)
// ============================================================================

export const households = pgTable(
  'households',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    inviteCode: text('invite_code'),
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

export const householdInvites = pgTable(
  'household_invites',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    email: text('email'),
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

// ============================================================================
// USER FINANCIAL PROFILE
// ============================================================================

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    onboardingCompleted: boolean('onboarding_completed')
      .notNull()
      .default(false),
    onboardingStep: bigint('onboarding_step', { mode: 'number' })
      .notNull()
      .default(0),
    monthlySalaryCents: bigint('monthly_salary_cents', { mode: 'number' }),
    payFrequency: payFrequencyEnum('pay_frequency'),
    nextPayday: text('next_payday'),
    monthlySavingsGoalCents: bigint('monthly_savings_goal_cents', {
      mode: 'number',
    }),
    emergencyFundGoalCents: bigint('emergency_fund_goal_cents', {
      mode: 'number',
    }),
    dailySpendingLimitCents: bigint('daily_spending_limit_cents', {
      mode: 'number',
    }),
    weeklySpendingLimitCents: bigint('weekly_spending_limit_cents', {
      mode: 'number',
    }),
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

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
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

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    emoji: text('emoji'),
    color: text('color'),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('category_user_idx').on(table.userId)]
);

export const categoryPatterns = pgTable(
  'category_patterns',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id').notNull(),
    patternType: patternTypeEnum('pattern_type').notNull(),
    patternValue: text('pattern_value').notNull(),
    matchCount: bigint('match_count', { mode: 'number' }).notNull().default(0),
    confidence: real('confidence').notNull().default(0.5),
    learnedFrom: learnedFromEnum('learned_from').notNull(),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('pattern_user_idx').on(table.userId),
    index('pattern_category_idx').on(table.categoryId),
    index('pattern_type_value_idx').on(table.patternType, table.patternValue),
  ]
);

export const envelopes = pgTable(
  'envelopes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id').notNull(),
    month: text('month').notNull(),
    budgetCents: bigint('budget_cents', { mode: 'number' }).notNull(),
    spentCents: bigint('spent_cents', { mode: 'number' }).notNull().default(0),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('envelope_user_idx').on(table.userId),
    index('envelope_month_category_idx').on(table.month, table.categoryId),
  ]
);

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    date: text('date').notNull(),
    description: text('description').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
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
// DEBT COPILOT
// ============================================================================

export const debts = pgTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: debtTypeEnum('type').notNull(),
    accountId: text('account_id'),
    originalBalanceCents: bigint('original_balance_cents', {
      mode: 'number',
    }).notNull(),
    currentBalanceCents: bigint('current_balance_cents', {
      mode: 'number',
    }).notNull(),
    aprPercent: real('apr_percent').notNull(),
    minimumPaymentCents: bigint('minimum_payment_cents', { mode: 'number' }),
    minimumPaymentType: minimumPaymentTypeEnum('minimum_payment_type').default(
      'fixed'
    ),
    minimumPaymentPercent: real('minimum_payment_percent'),
    termMonths: bigint('term_months', { mode: 'number' }), // Loan duration in months (null for revolving credit)
    startDate: text('start_date'), // ISO date when loan was originated (optional)
    dueDay: bigint('due_day', { mode: 'number' }),
    nextDueDate: text('next_due_date'),
    status: debtStatusEnum('status').notNull().default('active'),
    deathDate: text('death_date'),
    totalInterestProjectedCents: bigint('total_interest_projected_cents', {
      mode: 'number',
    }),
    dangerScore: bigint('danger_score', { mode: 'number' }),
    actualPaymentCents: bigint('actual_payment_cents', { mode: 'number' }),
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

// ============================================================================
// GOALS
// ============================================================================

export const goals = pgTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    emoji: text('emoji'),
    targetAmountCents: bigint('target_amount_cents', {
      mode: 'number',
    }).notNull(),
    currentAmountCents: bigint('current_amount_cents', { mode: 'number' })
      .notNull()
      .default(0),
    targetDate: text('target_date'),
    startDate: text('start_date').notNull(),
    goalType: goalTypeEnum('goal_type').notNull(),
    linkedDebtId: text('linked_debt_id'),
    linkedAccountId: text('linked_account_id'),
    progressPercent: real('progress_percent').notNull().default(0),
    onTrack: boolean('on_track').default(true),
    projectedCompletionDate: text('projected_completion_date'),
    recommendedMonthlyCents: bigint('recommended_monthly_cents', {
      mode: 'number',
    }),
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
// SCHEDULED PAYMENTS (BILLS)
// ============================================================================

export const scheduledBills = pgTable(
  'scheduled_bills',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: billTypeEnum('type').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    dueDay: bigint('due_day', { mode: 'number' }).notNull(),
    frequency: billFrequencyEnum('frequency').notNull().default('monthly'),
    categoryId: text('category_id'),
    linkedDebtId: text('linked_debt_id'),
    autoPay: boolean('auto_pay').default(false),
    reminderDaysBefore: bigint('reminder_days_before', {
      mode: 'number',
    }).default(3),
    isVariable: boolean('is_variable').default(false),
    amountHistory: text('amount_history'), // JSON: number[] (last N amounts in cents for variable bills)
    status: billStatusEnum('status').notNull().default('active'),
    nextDueDate: text('next_due_date'),
    lastPaidDate: text('last_paid_date'),
    notes: text('notes'),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('scheduled_bill_user_idx').on(table.userId),
    index('scheduled_bill_due_idx').on(table.dueDay),
    index('scheduled_bill_status_idx').on(table.status),
  ]
);

// ============================================================================
// SCHEDULED INCOME (PAYCHECKS)
// ============================================================================

export const scheduledIncome = pgTable(
  'scheduled_income',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    source: incomeSourceEnum('source').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    payDay: bigint('pay_day', { mode: 'number' }).notNull(),
    frequency: payFrequencyEnum('frequency').notNull().default('monthly'),
    accountId: text('account_id'),
    isVariable: boolean('is_variable').default(false),
    status: incomeStatusEnum('status').notNull().default('active'),
    nextPayDate: text('next_pay_date'),
    lastReceivedDate: text('last_received_date'),
    notes: text('notes'),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('scheduled_income_user_idx').on(table.userId),
    index('scheduled_income_payday_idx').on(table.payDay),
    index('scheduled_income_status_idx').on(table.status),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Envelope = typeof envelopes.$inferSelect;
export type NewEnvelope = typeof envelopes.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type ScheduledBill = typeof scheduledBills.$inferSelect;
export type NewScheduledBill = typeof scheduledBills.$inferInsert;
export type ScheduledIncome = typeof scheduledIncome.$inferSelect;
export type NewScheduledIncome = typeof scheduledIncome.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;
export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type NewHouseholdInvite = typeof householdInvites.$inferInsert;

// ============================================================================
// FILE UPLOADS - S3/R2 file storage and parsing
// ============================================================================

export const uploadedFiles = pgTable(
  'uploaded_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    status: fileStatusEnum('status').notNull().default('stored'),
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

export const fileParsedSummaries = pgTable(
  'file_parsed_summaries',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    parserVersion: text('parser_version').notNull(),
    documentType: documentTypeEnum('document_type').notNull(),
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

export const fileImportedItems = pgTable(
  'file_imported_items',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    parsedItemId: text('parsed_item_id').notNull(),
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

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type NewUploadedFile = typeof uploadedFiles.$inferInsert;
export type FileParsedSummary = typeof fileParsedSummaries.$inferSelect;
export type NewFileParsedSummary = typeof fileParsedSummaries.$inferInsert;
export type FileImportedItem = typeof fileImportedItems.$inferSelect;
export type NewFileImportedItem = typeof fileImportedItems.$inferInsert;

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

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type NewInterviewSession = typeof interviewSessions.$inferInsert;

// ============================================================================
// DECISION ENGINE - The core product
// ============================================================================

export const decisionState = pgTable(
  'decision_state',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    decisionVersion: text('decision_version').notNull(),
    riskLevel: riskLevelEnum('risk_level').notNull(),
    primaryCommandType: commandTypeEnum('primary_command_type').notNull(),
    primaryCommandText: text('primary_command_text').notNull(),
    primaryCommandAmount: bigint('primary_command_amount_cents', {
      mode: 'number',
    }),
    primaryCommandTarget: text('primary_command_target'),
    primaryCommandDate: text('primary_command_date'),
    warning1: text('warning_1'),
    warning2: text('warning_2'),
    nextActionText: text('next_action_text').notNull(),
    nextActionUrl: text('next_action_url').notNull(),
    decisionBasisJson: text('decision_basis_json'),
    computedAt: bigint('computed_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    isLocked: boolean('is_locked').notNull().default(false),
    acknowledgedAt: bigint('acknowledged_at', { mode: 'number' }),
  },
  (table) => [
    index('decision_state_user_idx').on(table.userId),
    index('decision_state_expires_idx').on(table.expiresAt),
  ]
);

export type DecisionState = typeof decisionState.$inferSelect;
export type NewDecisionState = typeof decisionState.$inferInsert;

// ============================================================================
// SUBSCRIPTIONS - Payment history and subscription management
// ============================================================================

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Plan details
    plan: subscriptionPlanEnum('plan').notNull(),
    billingPeriod: billingPeriodEnum('billing_period').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('USD'),

    // Payment gateway info
    provider: paymentProviderEnum('provider').notNull().default('tilopay'),
    providerOrderNumber: text('provider_order_number'),
    providerTransactionId: text('provider_transaction_id'),
    providerAuth: text('provider_auth'),

    // Status
    status: subscriptionStatusEnum('status').notNull().default('pending'),

    // Dates
    startDate: bigint('start_date', { mode: 'number' }),
    endDate: bigint('end_date', { mode: 'number' }),
    cancelledAt: bigint('cancelled_at', { mode: 'number' }),

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
    index('subscription_provider_order_idx').on(table.providerOrderNumber),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

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

export type AdvisorSession = typeof advisorSessions.$inferSelect;
export type NewAdvisorSession = typeof advisorSessions.$inferInsert;

// ============================================================================
// GROCERY LISTS - Shopping list management
// ============================================================================

export const groceryLists = pgTable(
  'grocery_lists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('grocery_list_user_idx').on(table.userId)]
);

export type GroceryList = typeof groceryLists.$inferSelect;
export type NewGroceryList = typeof groceryLists.$inferInsert;

export const groceryItems = pgTable(
  'grocery_items',
  {
    id: text('id').primaryKey(),
    listId: text('list_id').notNull(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    quantity: text('quantity'),
    checked: boolean('checked').notNull().default(false),
    sortOrder: bigint('sort_order', { mode: 'number' }).notNull().default(0),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('grocery_item_list_idx').on(table.listId),
    index('grocery_item_user_idx').on(table.userId),
  ]
);

export type GroceryItem = typeof groceryItems.$inferSelect;
export type NewGroceryItem = typeof groceryItems.$inferInsert;

export const groceryStores = pgTable(
  'grocery_stores',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#06b6d4'),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('grocery_store_user_idx').on(table.userId)]
);

export type GroceryStore = typeof groceryStores.$inferSelect;
export type NewGroceryStore = typeof groceryStores.$inferInsert;

export const groceryItemPrices = pgTable(
  'grocery_item_prices',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull(),
    storeId: text('store_id').notNull(),
    userId: text('user_id').notNull(),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('grocery_price_item_idx').on(table.itemId),
    index('grocery_price_store_idx').on(table.storeId),
    index('grocery_price_user_idx').on(table.userId),
  ]
);

export type GroceryItemPrice = typeof groceryItemPrices.$inferSelect;
export type NewGroceryItemPrice = typeof groceryItemPrices.$inferInsert;
