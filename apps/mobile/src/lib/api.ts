import Constants from 'expo-constants';

// API base URL - configure in app.json extra or use environment
const API_URL =
  Constants.expoConfig?.extra?.apiUrl || 'https://budgetcopilot.app/api/v1';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

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
      (headers as Record<string, string>)['Authorization'] = `Bearer ${
        this.token
      }`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;
  }

  // Auth endpoints
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

  // Transaction endpoints
  async getTransactions(params?: {
    month?: string;
    category?: string;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.set('month', params.month);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.fetch(`/transactions${query ? `?${query}` : ''}`);
  }

  async createTransaction(data: {
    description: string;
    amountCents: number;
    date: string;
    categoryId?: string;
  }) {
    return this.fetch('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Budget endpoints
  async getBudgets(month?: string) {
    const query = month ? `?month=${month}` : '';
    return this.fetch(`/budgets${query}`);
  }

  // Dashboard
  async getDashboard() {
    return this.fetch('/dashboard');
  }
}

export const api = new ApiClient(API_URL);
