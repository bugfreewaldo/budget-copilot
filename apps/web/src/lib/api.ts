/**
 * API Client for Budget Copilot
 * Handles all HTTP requests to the backend API
 */

// Use Next.js API routes (same origin)
const API_BASE_URL = '/api';

// ============================================================================
// Authentication
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  plan: 'free' | 'pro' | 'premium';
  role: 'user' | 'admin' | 'superadmin';
}

export interface AuthResponse {
  user: User;
  message: string;
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  return await fetchApi<AuthResponse>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    credentials: 'include',
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return await fetchApi<AuthResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    credentials: 'include',
  });
}

export async function logout(): Promise<{ message: string }> {
  return await fetchApi<{ message: string }>('/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getCurrentUser(): Promise<{ user: User } | null> {
  try {
    return await fetchApi<{ user: User }>('/v1/auth/me', {
      credentials: 'include',
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.statusCode === 401 || error.statusCode === 0)
    ) {
      return null;
    }
    throw error;
  }
}

export async function forgotPassword(
  email: string
): Promise<{ message: string }> {
  return await fetchApi<{ message: string }>('/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    credentials: 'include',
  });
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ message: string }> {
  return await fetchApi<{ message: string }>('/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
    credentials: 'include',
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  return await fetchApi<{ message: string }>('/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
    credentials: 'include',
  });
}

/**
 * RFC 7807 Problem+JSON error structure
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public problem?: ProblemDetails
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always include cookies for auth
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();

    // Handle error responses (Problem+JSON format)
    if (!response.ok) {
      const problem = data as ProblemDetails;
      throw new ApiError(
        problem.detail || 'API request failed',
        response.status,
        problem
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or parsing errors
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// ============================================================================
// Accounts
// ============================================================================

export interface Account {
  id: string;
  name: string;
  institution: string | null;
  type: 'checking' | 'savings' | 'credit' | 'cash';
  createdAt: string;
}

export async function getAccounts(): Promise<Account[]> {
  const response = await fetchApi<{ data: Account[] }>('/v1/accounts');
  return response.data;
}

export async function createAccount(input: {
  name: string;
  institution?: string;
  type: 'checking' | 'savings' | 'credit' | 'cash';
}): Promise<Account> {
  const response = await fetchApi<{ data: Account }>('/v1/accounts', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  return response.data;
}

// ============================================================================
// Categories
// ============================================================================

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  emoji: string | null;
  color: string | null;
  createdAt: number; // Unix timestamp in ms
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
  count: number;
}

/**
 * List categories with cursor-based pagination and search
 */
export async function listCategories(params?: {
  cursor?: string;
  limit?: number;
  q?: string;
}): Promise<Page<Category>> {
  const queryParams = new URLSearchParams();
  if (params?.cursor) queryParams.append('cursor', params.cursor);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.q) queryParams.append('q', params.q);

  const query = queryParams.toString();
  return await fetchApi<Page<Category>>(
    `/v1/categories${query ? `?${query}` : ''}`
  );
}

/**
 * Get a single category by ID
 */
export async function getCategory(id: string): Promise<Category> {
  const response = await fetchApi<{ data: Category }>(`/v1/categories/${id}`);
  return response.data;
}

/**
 * Create a new category
 */
export async function createCategory(input: {
  name: string;
  parent_id?: string | null;
}): Promise<Category> {
  const response = await fetchApi<{ data: Category }>('/v1/categories', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  return response.data;
}

/**
 * Update a category
 */
export async function updateCategory(
  id: string,
  input: {
    name?: string;
    parent_id?: string | null;
  }
): Promise<Category> {
  const response = await fetchApi<{ data: Category }>(`/v1/categories/${id}`, {
    method: 'PATCH',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  return response.data;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<void> {
  await fetchApi<void>(`/v1/categories/${id}`, {
    method: 'DELETE',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
  });
}

/**
 * Get all categories (convenience wrapper around listCategories)
 */
export async function getCategories(): Promise<Category[]> {
  const result = await listCategories({ limit: 500 });
  return result.data;
}

// ============================================================================
// Transactions
// ============================================================================

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  type: 'income' | 'expense';
  categoryId: string | null;
  accountId: string;
  cleared: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  accountId?: string;
  q?: string;
}

export async function getTransactions(
  filters?: TransactionFilters
): Promise<Transaction[]> {
  const params = new URLSearchParams();

  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);
  if (filters?.categoryId) params.append('categoryId', filters.categoryId);
  if (filters?.accountId) params.append('accountId', filters.accountId);
  if (filters?.q) params.append('q', filters.q);

  const query = params.toString();
  const response = await fetchApi<{ data: Transaction[] }>(
    `/v1/transactions${query ? `?${query}` : ''}`
  );
  return response.data;
}

export async function createTransaction(input: {
  date: string;
  description: string;
  amountCents: number;
  type: 'income' | 'expense';
  categoryId?: string;
  accountId: string;
  cleared?: boolean;
  notes?: string;
}): Promise<Transaction> {
  const response = await fetchApi<{ data: Transaction }>('/v1/transactions', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateTransaction(
  id: string,
  input: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Transaction> {
  const response = await fetchApi<{ data: Transaction }>(
    `/v1/transactions/${id}`,
    {
      method: 'PATCH',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await fetchApi<void>(`/v1/transactions/${id}`, {
    method: 'DELETE',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
  });
}

// ============================================================================
// Envelopes
// ============================================================================

export interface Envelope {
  id: string;
  categoryId: string;
  month: string;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  createdAt: string;
}

export async function getEnvelopes(month: string): Promise<Envelope[]> {
  const response = await fetchApi<{ data: Envelope[] }>(
    `/v1/envelopes?month=${month}`
  );
  return response.data;
}

export async function upsertEnvelope(input: {
  categoryId: string;
  month: string;
  budgetCents: number;
}): Promise<Envelope> {
  const response = await fetchApi<{ data: Envelope }>('/v1/envelopes', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  return response.data;
}

// ============================================================================
// Health Check
// ============================================================================

export interface HealthStatus {
  status: string;
  dbFile: string;
  timestamp: string;
}

export async function getHealth(): Promise<HealthStatus> {
  return await fetchApi<HealthStatus>('/health');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format cents to dollar string
 */
export function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  return cents < 0 ? `-$${dollars.toFixed(2)}` : `$${dollars.toFixed(2)}`;
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get first day of current month in YYYY-MM-DD format
 */
export function getFirstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Format a Unix timestamp (ms) to a human-readable date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength = 48): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Copilot
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ExtractedTransaction {
  amountCents: number;
  description: string;
  merchant: string | null;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  type: 'income' | 'expense';
  notes: string | null;
}

export interface CopilotResponse {
  message: string;
  transaction?: ExtractedTransaction;
  transactionCreated?: boolean;
  transactionId?: string;
  suggestedCategories?: Array<{
    id: string;
    name: string;
    emoji: string | null;
  }>;
  needsMoreInfo?: boolean;
  missingFields?: string[];
}

export interface QuickAction {
  text: string;
  example: string;
}

/**
 * Send a message to the transaction copilot
 */
export async function sendCopilotMessage(
  message: string,
  conversationHistory: ChatMessage[] = []
): Promise<CopilotResponse> {
  const response = await fetchApi<{ data: CopilotResponse }>(
    '/v1/copilot/chat',
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ message, conversationHistory }),
    }
  );
  return response.data;
}

/**
 * Update the category of a recently created transaction
 */
export async function updateCopilotTransactionCategory(
  transactionId: string,
  categoryId: string
): Promise<{ success: boolean }> {
  const response = await fetchApi<{ data: { success: boolean } }>(
    '/v1/copilot/update-category',
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ transactionId, categoryId }),
    }
  );
  return response.data;
}

/**
 * Get quick action suggestions for the copilot
 */
export async function getCopilotQuickActions(): Promise<QuickAction[]> {
  const response = await fetchApi<{ data: QuickAction[] }>(
    '/v1/copilot/quick-actions'
  );
  return response.data;
}

// ============================================================================
// Debts (Copiloto de Deudas)
// ============================================================================

export type DebtType =
  | 'credit_card'
  | 'personal_loan'
  | 'auto_loan'
  | 'mortgage'
  | 'student_loan'
  | 'medical'
  | 'other';
export type DebtStatus = 'active' | 'paid_off' | 'defaulted' | 'deferred';
export type MinimumPaymentType = 'fixed' | 'percent';

export interface Debt {
  id: string;
  userId: string;
  name: string;
  type: DebtType;
  accountId: string | null;
  originalBalanceCents: number;
  currentBalanceCents: number;
  aprPercent: number;
  minimumPaymentCents: number | null;
  minimumPaymentType: MinimumPaymentType | null;
  minimumPaymentPercent: number | null;
  effectiveMinimumPaymentCents: number | null;
  termMonths: number | null;
  startDate: string | null;
  dueDay: number | null;
  nextDueDate: string | null;
  status: DebtStatus;
  deathDate: string | null;
  totalInterestProjectedCents: number | null;
  dangerScore: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  transactionId: string | null;
  amountCents: number;
  principalCents: number | null;
  interestCents: number | null;
  paymentDate: string;
  createdAt: number;
}

export interface DebtSummary {
  totalDebtCents: number;
  totalMinPaymentCents: number;
  activeCount: number;
}

export interface DebtStrategies {
  avalanche: {
    totalInterestCents: number;
    monthsToPayoff: number;
    order: Array<{ id: string; name: string; balance: number; apr: number }>;
  };
  snowball: {
    totalInterestCents: number;
    monthsToPayoff: number;
    order: Array<{ id: string; name: string; balance: number; apr: number }>;
  };
  recommendation: 'avalanche' | 'snowball';
  savingsWithAvalanche: number;
}

export async function listDebts(params?: {
  cursor?: string;
  limit?: number;
  status?: DebtStatus;
}): Promise<Page<Debt> & { summary: DebtSummary }> {
  const queryParams = new URLSearchParams();
  if (params?.cursor) queryParams.append('cursor', params.cursor);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);

  const query = queryParams.toString();
  return await fetchApi<Page<Debt> & { summary: DebtSummary }>(
    `/v1/debts${query ? `?${query}` : ''}`
  );
}

export async function getDebt(
  id: string
): Promise<Debt & { payments: DebtPayment[] }> {
  const response = await fetchApi<{ data: Debt & { payments: DebtPayment[] } }>(
    `/v1/debts/${id}`
  );
  return response.data;
}

export async function createDebt(input: {
  name: string;
  type: DebtType;
  original_balance_cents: number;
  current_balance_cents: number;
  apr_percent: number;
  minimum_payment_cents?: number | null;
  minimum_payment_type?: MinimumPaymentType;
  minimum_payment_percent?: number | null;
  term_months?: number | null;
  start_date?: string | null;
  due_day?: number;
  account_id?: string | null;
}): Promise<Debt> {
  const response = await fetchApi<{ data: Debt }>('/v1/debts', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      name: input.name,
      type: input.type,
      originalBalanceCents: input.original_balance_cents,
      currentBalanceCents: input.current_balance_cents,
      aprPercent: input.apr_percent,
      minimumPaymentCents: input.minimum_payment_cents,
      minimumPaymentType: input.minimum_payment_type,
      minimumPaymentPercent: input.minimum_payment_percent,
      termMonths: input.term_months,
      startDate: input.start_date,
      dueDay: input.due_day,
      accountId: input.account_id,
    }),
  });
  return response.data;
}

export async function updateDebt(
  id: string,
  input: {
    name?: string;
    type?: DebtType;
    current_balance_cents?: number;
    apr_percent?: number;
    minimum_payment_cents?: number | null;
    minimum_payment_type?: MinimumPaymentType;
    minimum_payment_percent?: number | null;
    term_months?: number | null;
    start_date?: string | null;
    due_day?: number;
    status?: DebtStatus;
  }
): Promise<Debt> {
  const response = await fetchApi<{ data: Debt }>(`/v1/debts/${id}`, {
    method: 'PATCH',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      name: input.name,
      type: input.type,
      currentBalanceCents: input.current_balance_cents,
      aprPercent: input.apr_percent,
      minimumPaymentCents: input.minimum_payment_cents,
      minimumPaymentType: input.minimum_payment_type,
      minimumPaymentPercent: input.minimum_payment_percent,
      termMonths: input.term_months,
      startDate: input.start_date,
      dueDay: input.due_day,
      status: input.status,
    }),
  });
  return response.data;
}

export async function recordDebtPayment(
  debtId: string,
  input: {
    amount_cents: number;
    principal_cents?: number;
    interest_cents?: number;
    payment_date: string;
  }
): Promise<DebtPayment> {
  const response = await fetchApi<{ data: DebtPayment }>(
    `/v1/debts/${debtId}/payments`,
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        amountCents: input.amount_cents,
        date: input.payment_date,
      }),
    }
  );
  return response.data;
}

export async function deleteDebt(id: string): Promise<void> {
  await fetchApi<void>(`/v1/debts/${id}`, {
    method: 'DELETE',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
  });
}

export async function getDebtStrategies(): Promise<DebtStrategies> {
  const response = await fetchApi<{ data: DebtStrategies }>(
    '/v1/debts/strategies'
  );
  return response.data;
}

// ============================================================================
// Goals (Seguimiento de Metas)
// ============================================================================

export type GoalType =
  | 'savings'
  | 'debt_payoff'
  | 'purchase'
  | 'emergency_fund'
  | 'investment'
  | 'other';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate: string | null;
  startDate: string;
  goalType: GoalType;
  linkedDebtId: string | null;
  linkedAccountId: string | null;
  progressPercent: number;
  onTrack: boolean;
  projectedCompletionDate: string | null;
  recommendedMonthlyCents: number | null;
  status: GoalStatus;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface GoalSummary {
  activeCount: number;
  totalTargetCents: number;
  totalCurrentCents: number;
  overallProgressPercent: number;
  onTrackCount: number;
}

export async function listGoals(params?: {
  cursor?: string;
  limit?: number;
  status?: GoalStatus;
  type?: GoalType;
}): Promise<Page<Goal> & { summary: GoalSummary }> {
  const queryParams = new URLSearchParams();
  if (params?.cursor) queryParams.append('cursor', params.cursor);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.type) queryParams.append('type', params.type);

  const query = queryParams.toString();
  return await fetchApi<Page<Goal> & { summary: GoalSummary }>(
    `/v1/goals${query ? `?${query}` : ''}`
  );
}

export async function getGoal(id: string): Promise<Goal> {
  const response = await fetchApi<{ data: Goal }>(`/v1/goals/${id}`);
  return response.data;
}

export async function createGoal(input: {
  name: string;
  description?: string;
  emoji?: string;
  target_amount_cents: number;
  current_amount_cents?: number;
  target_date?: string;
  goal_type: GoalType;
  linked_debt_id?: string | null;
  linked_account_id?: string | null;
}): Promise<Goal> {
  const response = await fetchApi<{ data: Goal }>('/v1/goals', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateGoal(
  id: string,
  input: {
    name?: string;
    description?: string;
    emoji?: string;
    target_amount_cents?: number;
    current_amount_cents?: number;
    target_date?: string | null;
    status?: GoalStatus;
  }
): Promise<Goal> {
  const response = await fetchApi<{ data: Goal }>(`/v1/goals/${id}`, {
    method: 'PATCH',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function contributeToGoal(
  goalId: string,
  amountCents: number
): Promise<{
  data: Goal;
  contribution: {
    amountCents: number;
    newTotalCents: number;
    isCompleted: boolean;
  };
}> {
  const response = await fetchApi<{
    data: Goal;
    contribution: {
      amountCents: number;
      newTotalCents: number;
      isCompleted: boolean;
    };
  }>(`/v1/goals/${goalId}/contribute`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ amount_cents: amountCents }),
  });
  return response;
}

export async function deleteGoal(id: string): Promise<void> {
  await fetchApi<void>(`/v1/goals/${id}`, {
    method: 'DELETE',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
  });
}

// ============================================================================
// File Uploads
// ============================================================================

export type FileStatus = 'stored' | 'processing' | 'processed' | 'failed';
export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'bank_statement'
  | 'excel_table';

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  createdAt: string;
}

export interface UploadTarget {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface ParsedTransaction {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  isCredit?: boolean;
}

export interface ParsedReceipt {
  documentType: 'receipt' | 'invoice';
  currency: string;
  mainTransaction: {
    id: 'main';
    date: string;
    merchant: string;
    amount: number;
    categoryGuess?: string | null;
    notes?: string | null;
  };
}

export interface ParsedBankStatement {
  documentType: 'bank_statement';
  accountName?: string | null;
  period?: {
    from?: string | null;
    to?: string | null;
  };
  currency: string;
  transactions: ParsedTransaction[];
}

export type ParsedSummary = ParsedReceipt | ParsedBankStatement;

/**
 * Type guard to check if a parsed summary is a receipt/invoice
 */
export function isReceipt(summary: ParsedSummary): summary is ParsedReceipt {
  return (
    summary.documentType === 'receipt' || summary.documentType === 'invoice'
  );
}

/**
 * Type guard to check if a parsed summary is a bank statement
 */
export function isBankStatement(
  summary: ParsedSummary
): summary is ParsedBankStatement {
  return summary.documentType === 'bank_statement';
}

export interface FileSummaryResponse {
  documentType: DocumentType;
  parserVersion: string;
  summary: ParsedSummary;
  importedItemIds: string[];
}

export interface ImportResult {
  ok: boolean;
  imported: string[];
  skipped: string[];
  errors: Array<{ itemId: string; error: string }>;
}

/**
 * Request pre-signed upload URLs for files
 */
export async function createUploadUrls(
  files: Array<{ filename: string; mimeType: string; size: number }>
): Promise<{ uploadTargets: UploadTarget[] }> {
  // Map to API expected format: name, type, size
  const apiFiles = files.map((f) => ({
    name: f.filename,
    type: f.mimeType,
    size: f.size,
  }));

  return await fetchApi<{ uploadTargets: UploadTarget[] }>(
    '/v1/uploads/create-url',
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ files: apiFiles }),
    }
  );
}

/**
 * Complete file upload after uploading to S3
 */
export async function completeUpload(
  completedFiles: Array<{
    storageKey: string;
    originalName: string;
    mimeType: string;
    size: number;
  }>
): Promise<{
  ok: boolean;
  fileIds: string[];
  parsed: string[];
  queued: string[];
}> {
  return await fetchApi<{
    ok: boolean;
    fileIds: string[];
    parsed: string[];
    queued: string[];
  }>('/v1/uploads/complete', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ completedFiles }),
  });
}

/**
 * List user's uploaded files
 */
export async function listFiles(): Promise<UploadedFile[]> {
  const response = await fetchApi<{ data: UploadedFile[] }>('/v1/files');
  return response.data;
}

/**
 * Get parsed summary for a file
 */
export async function getFileSummary(
  fileId: string
): Promise<FileSummaryResponse> {
  return await fetchApi<FileSummaryResponse>(`/v1/files/${fileId}/summary`);
}

/**
 * Import parsed items as transactions
 */
export interface ImportItem {
  id: string;
  categoryId?: string;
}

export async function importFileItems(
  fileId: string,
  items: ImportItem[],
  options?: {
    defaultType?: 'income' | 'expense';
    accountId?: string;
  }
): Promise<ImportResult> {
  return await fetchApi<ImportResult>(`/v1/files/${fileId}/import`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      items,
      defaultType: options?.defaultType,
      accountId: options?.accountId,
    }),
  });
}

/**
 * Upload a file directly to S3 using pre-signed URL
 */
export async function uploadFileToS3(
  file: File,
  uploadUrl: string
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
}
