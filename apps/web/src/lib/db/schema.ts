import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Database schema for Budget Copilot
 * Shared schema for both API and Web serverless functions
 */

// ============================================================================
// USER AUTHENTICATION & IDENTITY
// ============================================================================

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .notNull()
      .default(false),
    emailVerifiedAt: integer('email_verified_at'),
    status: text('status', {
      enum: ['active', 'suspended', 'deleted'],
    })
      .notNull()
      .default('active'),
    role: text('role', {
      enum: ['user', 'admin', 'superadmin'],
    })
      .notNull()
      .default('user'),
    preferences: text('preferences'),
    plan: text('plan', {
      enum: ['free', 'pro', 'premium'],
    })
      .notNull()
      .default('free'),
    planExpiresAt: integer('plan_expires_at'),
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

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    token: text('token').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    deviceType: text('device_type', { enum: ['web', 'mobile', 'desktop'] }),
    expiresAt: integer('expires_at').notNull(),
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

export const emailVerificationTokens = sqliteTable(
  'email_verification_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    token: text('token').notNull(),
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
// HOUSEHOLDS (FAMILY SHARING)
// ============================================================================

export const households = sqliteTable(
  'households',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    inviteCode: text('invite_code'),
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

export const householdMembers = sqliteTable(
  'household_members',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', {
      enum: ['owner', 'admin', 'member', 'viewer'],
    })
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
    uniqueMember: uniqueIndex('household_member_unique_idx').on(
      table.householdId,
      table.userId
    ),
  })
);

export const householdInvites = sqliteTable(
  'household_invites',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    email: text('email'),
    token: text('token').notNull(),
    role: text('role', {
      enum: ['admin', 'member', 'viewer'],
    })
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

// ============================================================================
// USER FINANCIAL PROFILE
// ============================================================================

export const userProfiles = sqliteTable(
  'user_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    onboardingStep: integer('onboarding_step').notNull().default(0),
    monthlySalaryCents: integer('monthly_salary_cents'),
    payFrequency: text('pay_frequency', {
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
    }),
    nextPayday: text('next_payday'),
    monthlySavingsGoalCents: integer('monthly_savings_goal_cents'),
    emergencyFundGoalCents: integer('emergency_fund_goal_cents'),
    dailySpendingLimitCents: integer('daily_spending_limit_cents'),
    weeklySpendingLimitCents: integer('weekly_spending_limit_cents'),
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

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
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

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    emoji: text('emoji'),
    color: text('color'),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('category_user_idx').on(table.userId),
  })
);

export const envelopes = sqliteTable(
  'envelopes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id').notNull(),
    month: text('month').notNull(),
    budgetCents: integer('budget_cents').notNull(),
    spentCents: integer('spent_cents').notNull().default(0),
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

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    date: text('date').notNull(),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
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
// DEBT COPILOT
// ============================================================================

export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
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
    accountId: text('account_id'),
    originalBalanceCents: integer('original_balance_cents').notNull(),
    currentBalanceCents: integer('current_balance_cents').notNull(),
    aprPercent: real('apr_percent').notNull(),
    minimumPaymentCents: integer('minimum_payment_cents'),
    minimumPaymentType: text('minimum_payment_type', {
      enum: ['fixed', 'percent'],
    }).default('fixed'),
    minimumPaymentPercent: real('minimum_payment_percent'),
    termMonths: integer('term_months'), // Loan duration in months (null for revolving credit)
    startDate: text('start_date'), // ISO date when loan was originated (optional)
    dueDay: integer('due_day'),
    nextDueDate: text('next_due_date'),
    status: text('status', {
      enum: ['active', 'paid_off', 'defaulted', 'deferred'],
    })
      .notNull()
      .default('active'),
    deathDate: text('death_date'),
    totalInterestProjectedCents: integer('total_interest_projected_cents'),
    dangerScore: integer('danger_score'),
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

// ============================================================================
// GOALS
// ============================================================================

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    emoji: text('emoji'),
    targetAmountCents: integer('target_amount_cents').notNull(),
    currentAmountCents: integer('current_amount_cents').notNull().default(0),
    targetDate: text('target_date'),
    startDate: text('start_date').notNull(),
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
    linkedDebtId: text('linked_debt_id'),
    linkedAccountId: text('linked_account_id'),
    progressPercent: real('progress_percent').notNull().default(0),
    onTrack: integer('on_track', { mode: 'boolean' }).default(true),
    projectedCompletionDate: text('projected_completion_date'),
    recommendedMonthlyCents: integer('recommended_monthly_cents'),
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
// SCHEDULED PAYMENTS (BILLS)
// ============================================================================

export const scheduledBills = sqliteTable(
  'scheduled_bills',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: [
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
      ],
    }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    dueDay: integer('due_day').notNull(),
    frequency: text('frequency', {
      enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
    })
      .notNull()
      .default('monthly'),
    categoryId: text('category_id'),
    linkedDebtId: text('linked_debt_id'),
    autoPay: integer('auto_pay', { mode: 'boolean' }).default(false),
    reminderDaysBefore: integer('reminder_days_before').default(3),
    status: text('status', {
      enum: ['active', 'paused', 'completed'],
    })
      .notNull()
      .default('active'),
    nextDueDate: text('next_due_date'),
    lastPaidDate: text('last_paid_date'),
    notes: text('notes'),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('scheduled_bill_user_idx').on(table.userId),
    dueDayIdx: index('scheduled_bill_due_idx').on(table.dueDay),
    statusIdx: index('scheduled_bill_status_idx').on(table.status),
  })
);

// ============================================================================
// SCHEDULED INCOME (PAYCHECKS)
// ============================================================================

export const scheduledIncome = sqliteTable(
  'scheduled_income',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    source: text('source', {
      enum: [
        'salary',
        'freelance',
        'business',
        'investment',
        'rental',
        'side_hustle',
        'bonus',
        'other',
      ],
    }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    payDay: integer('pay_day').notNull(),
    frequency: text('frequency', {
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
    })
      .notNull()
      .default('monthly'),
    accountId: text('account_id'),
    isVariable: integer('is_variable', { mode: 'boolean' }).default(false),
    status: text('status', {
      enum: ['active', 'paused', 'ended'],
    })
      .notNull()
      .default('active'),
    nextPayDate: text('next_pay_date'),
    lastReceivedDate: text('last_received_date'),
    notes: text('notes'),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    userIdx: index('scheduled_income_user_idx').on(table.userId),
    payDayIdx: index('scheduled_income_payday_idx').on(table.payDay),
    statusIdx: index('scheduled_income_status_idx').on(table.status),
  })
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

export const uploadedFiles = sqliteTable(
  'uploaded_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
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

export const fileParsedSummaries = sqliteTable(
  'file_parsed_summaries',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    parserVersion: text('parser_version').notNull(),
    documentType: text('document_type', {
      enum: ['receipt', 'invoice', 'bank_statement', 'excel_table'],
    }).notNull(),
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

export const fileImportedItems = sqliteTable(
  'file_imported_items',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    parsedItemId: text('parsed_item_id').notNull(),
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

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type NewUploadedFile = typeof uploadedFiles.$inferInsert;
export type FileParsedSummary = typeof fileParsedSummaries.$inferSelect;
export type NewFileParsedSummary = typeof fileParsedSummaries.$inferInsert;
export type FileImportedItem = typeof fileImportedItems.$inferSelect;
export type NewFileImportedItem = typeof fileImportedItems.$inferInsert;
