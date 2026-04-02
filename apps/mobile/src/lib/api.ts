import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl || 'https://budgetcopilot.app/api/v1';

// === TYPES ===

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro' | 'premium';
}

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
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  emoji: string | null;
  color: string | null;
}

export interface Account {
  id: string;
  name: string;
  institution: string | null;
  type: 'checking' | 'savings' | 'credit' | 'cash';
}

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  goalType: string;
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate: string | null;
  status: string;
  progressPercent: number;
  onTrack: boolean;
  recommendedMonthlyCents: number | null;
}

export interface GoalSummary {
  activeCount: number;
  totalTargetCents: number;
  totalCurrentCents: number;
  overallProgressPercent: number;
  onTrackCount: number;
}

export interface Debt {
  id: string;
  name: string;
  type: string;
  currentBalanceCents: number;
  originalBalanceCents: number;
  aprPercent: number;
  minimumPaymentCents: number;
  status: string;
  dangerScore: number | null;
}

export interface DebtSummary {
  totalBalanceCents: number;
  totalMinPaymentCents: number;
  count: number;
}

export interface ScheduledBill {
  id: string;
  name: string;
  type: string;
  amountCents: number;
  dueDay: number;
  frequency: string;
  status: string;
  nextDueDate: string | null;
  autoPay: boolean | null;
  isVariable: boolean | null;
  amountHistory: string | null;
  notes: string | null;
}

export interface ScheduledIncome {
  id: string;
  name: string;
  source: string;
  amountCents: number;
  payDay: number;
  frequency: string;
  status: string;
  nextPayDate: string | null;
  isVariable: boolean | null;
  notes: string | null;
}

export interface GroceryList {
  id: string;
  name: string;
  totalItems: number;
  checkedItems: number;
  createdAt: number;
  updatedAt: number;
}

export interface GroceryItem {
  id: string;
  listId: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface GroceryStore {
  id: string;
  name: string;
  color: string;
}

export interface GroceryItemPrice {
  id: string;
  itemId: string;
  storeId: string;
  priceCents: number;
}

export interface BalanceResponse {
  currentBalanceCents: number;
}

// === API CLIENT ===

class ApiClient {
  private token: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] =
        `Bearer ${this.token}`;
    }

    const response = await globalThis.fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.fetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(
    name: string,
    email: string,
    password: string
  ): Promise<RegisterResponse> {
    return this.fetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async getMe(): Promise<User> {
    const response = await this.fetch<{ user: User }>('/auth/me');
    return response.user;
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  async getTransactions(params?: {
    from?: string;
    to?: string;
    type?: string;
    q?: string;
    limit?: number;
  }): Promise<{ data: Transaction[] }> {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.fetch<{ data: Transaction[] }>(
      `/transactions${query ? `?${query}` : ''}`
    );
  }

  async createTransaction(data: {
    date: string;
    description: string;
    amountCents: number;
    type: 'income' | 'expense';
    categoryId?: string;
    accountId: string;
  }): Promise<{ data: Transaction }> {
    return this.fetch<{ data: Transaction }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.fetch<undefined>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async getCategories(params?: {
    flat?: boolean;
    limit?: number;
  }): Promise<{ data: Category[] }> {
    const searchParams = new URLSearchParams();
    if (params?.flat !== undefined)
      searchParams.set('flat', String(params.flat));
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.fetch<{ data: Category[] }>(
      `/categories${query ? `?${query}` : ''}`
    );
  }

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------

  async getAccounts(): Promise<{ data: Account[] }> {
    return this.fetch<{ data: Account[] }>('/accounts');
  }

  // ---------------------------------------------------------------------------
  // Balance
  // ---------------------------------------------------------------------------

  async getBalance(): Promise<{ data: BalanceResponse }> {
    return this.fetch<{ data: BalanceResponse }>('/balance');
  }

  // ---------------------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------------------

  async getGoals(params?: {
    status?: string;
  }): Promise<{ data: Goal[]; summary: GoalSummary }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return this.fetch<{ data: Goal[]; summary: GoalSummary }>(
      `/goals${query ? `?${query}` : ''}`
    );
  }

  async createGoal(data: {
    name: string;
    goal_type: string;
    target_amount_cents: number;
    current_amount_cents?: number;
    target_date?: string;
    emoji?: string;
    description?: string;
  }): Promise<{ data: Goal }> {
    return this.fetch<{ data: Goal }>('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async contributeToGoal(
    id: string,
    amountCents: number
  ): Promise<{ data: Goal }> {
    return this.fetch<{ data: Goal }>(`/goals/${id}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    });
  }

  async deleteGoal(id: string): Promise<void> {
    await this.fetch<undefined>(`/goals/${id}`, {
      method: 'DELETE',
    });
  }

  // ---------------------------------------------------------------------------
  // Debts
  // ---------------------------------------------------------------------------

  async getDebts(): Promise<{ data: Debt[]; summary: DebtSummary }> {
    return this.fetch<{ data: Debt[]; summary: DebtSummary }>('/debts');
  }

  // ---------------------------------------------------------------------------
  // Scheduled Bills
  // ---------------------------------------------------------------------------

  async getScheduledBills(): Promise<{ data: ScheduledBill[] }> {
    return this.fetch<{ data: ScheduledBill[] }>('/scheduled-bills');
  }

  async createScheduledBill(data: {
    name: string;
    type: string;
    amountCents: number;
    dueDay: number;
    frequency: string;
    autoPay?: boolean;
    isVariable?: boolean;
    amountHistory?: number[];
  }): Promise<{ data: ScheduledBill }> {
    return this.fetch<{ data: ScheduledBill }>('/scheduled-bills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ---------------------------------------------------------------------------
  // Scheduled Income
  // ---------------------------------------------------------------------------

  async getScheduledIncome(): Promise<{ data: ScheduledIncome[] }> {
    return this.fetch<{ data: ScheduledIncome[] }>('/scheduled-income');
  }

  // ---------------------------------------------------------------------------
  // Grocery Lists
  // ---------------------------------------------------------------------------

  async getGroceryLists(): Promise<{ data: GroceryList[] }> {
    return this.fetch<{ data: GroceryList[] }>('/grocery-lists');
  }

  async createGroceryList(name: string): Promise<{ data: GroceryList }> {
    return this.fetch<{ data: GroceryList }>('/grocery-lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteGroceryList(id: string): Promise<void> {
    await this.fetch<undefined>(`/grocery-lists/${id}`, {
      method: 'DELETE',
    });
  }

  async getGroceryItems(listId: string): Promise<{ data: GroceryItem[] }> {
    return this.fetch<{ data: GroceryItem[] }>(
      `/grocery-lists/${listId}/items`
    );
  }

  async createGroceryItem(
    listId: string,
    data: { name: string; quantity?: string }
  ): Promise<{ data: GroceryItem }> {
    return this.fetch<{ data: GroceryItem }>(`/grocery-lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleGroceryItem(
    listId: string,
    itemId: string,
    checked: boolean
  ): Promise<{ data: GroceryItem }> {
    return this.fetch<{ data: GroceryItem }>(
      `/grocery-lists/${listId}/items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ checked }),
      }
    );
  }

  async deleteGroceryItem(listId: string, itemId: string): Promise<void> {
    await this.fetch<undefined>(`/grocery-lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // ---------------------------------------------------------------------------
  // Grocery Stores
  // ---------------------------------------------------------------------------

  async getGroceryStores(): Promise<{ data: GroceryStore[] }> {
    return this.fetch<{ data: GroceryStore[] }>('/grocery-stores');
  }

  // ---------------------------------------------------------------------------
  // Item Prices
  // ---------------------------------------------------------------------------

  async getItemPrices(itemId: string): Promise<{ data: GroceryItemPrice[] }> {
    return this.fetch<{ data: GroceryItemPrice[] }>(`/item-prices/${itemId}`);
  }

  async setItemPrice(
    itemId: string,
    data: { storeId: string; priceCents: number }
  ): Promise<{ data: GroceryItemPrice }> {
    return this.fetch<{ data: GroceryItemPrice }>(`/item-prices/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient(API_URL);
