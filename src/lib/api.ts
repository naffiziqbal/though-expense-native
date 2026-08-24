// Ported from client/lib/api.ts for React Native (token in SecureStore, in-memory cache)
import axios, { AxiosError, AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type {
  AuthResponse,
  BudgetSummary,
  CategoryBudgetProgress,
  CategorySummaryResponse,
  Expense,
  ExpenseFilters,
  ExpensesResponse,
  GenerateInsightsResponse,
  InsightsResponse,
  LoginRequest,
  ParseExpenseRequest,
  ParseExpenseResponse,
  SignupRequest,
  UpdateExpenseRequest,
} from './types';

const TOKEN_KEY = 'thoughtexpense_token';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7100';

/** Called when a 401 invalidates the session (wired up by the auth store). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          const url = error.config?.url || '';
          const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/signup');
          if (!isAuthEndpoint) {
            await this.clearToken();
            onUnauthorized?.();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Token management
  async loadToken(): Promise<string | null> {
    if (this.token) return this.token;
    try {
      this.token = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      this.token = null;
    }
    return this.token;
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {
      // in-memory only fallback
    }
  }

  async clearToken(): Promise<void> {
    this.token = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  }

  hasToken(): boolean {
    return !!this.token;
  }

  // Auth endpoints
  async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/signup', data);
    if (response.data.success && response.data.data.token) {
      await this.setToken(response.data.data.token);
    }
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/login', data);
    if (response.data.success && response.data.data.token) {
      await this.setToken(response.data.data.token);
    }
    return response.data;
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/auth/reset-password', { token, password });
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/auth/change-password', { currentPassword, newPassword });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  async updateProfile(data: { name?: string | null; currency?: string }) {
    const response = await this.client.patch('/api/auth/profile', data);
    return response.data;
  }

  /** Upload profile picture from a local image URI (expo-image-picker result). */
  async uploadProfilePicture(uri: string, mimeType?: string, fileName?: string) {
    const formData = new FormData();
    const name = fileName || uri.split('/').pop() || 'avatar.jpg';
    const type = mimeType || 'image/jpeg';
    // React Native FormData file object
    formData.append('image', { uri, name, type } as unknown as Blob);
    const response = await this.client.post('/api/auth/profile/picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async logout(): Promise<void> {
    await this.clearToken();
  }

  // Expense endpoints
  async parseExpenses(data: ParseExpenseRequest & { create?: boolean }): Promise<ParseExpenseResponse> {
    const response = await this.client.post<ParseExpenseResponse>('/api/expenses/parse', data);
    return response.data;
  }

  async createExpense(data: {
    description: string;
    amount: number;
    currency?: string;
    category?: string;
    date?: string;
    rawInput?: string;
  }): Promise<{ success: boolean; message: string; data: { expense: Expense } }> {
    const response = await this.client.post('/api/expenses', data);
    return response.data;
  }

  async getExpenses(filters?: ExpenseFilters): Promise<ExpensesResponse> {
    const response = await this.client.get<ExpensesResponse>('/api/expenses', { params: filters });
    return response.data;
  }

  async getExpenseById(id: string): Promise<{ success: boolean; data: { expense: Expense } }> {
    const response = await this.client.get(`/api/expenses/${id}`);
    return response.data;
  }

  async updateExpense(
    id: string,
    data: UpdateExpenseRequest
  ): Promise<{ success: boolean; message: string; data: { expense: Expense } }> {
    const response = await this.client.patch(`/api/expenses/${id}`, data);
    return response.data;
  }

  async deleteExpense(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/api/expenses/${id}`);
    return response.data;
  }

  /** Returns raw file bytes (csv or pdf) for native saving/sharing. */
  async exportExpenses(format: 'csv' | 'pdf', from?: string, to?: string): Promise<ArrayBuffer> {
    const response = await this.client.get('/api/expenses/export', {
      params: { format, from, to },
      responseType: 'arraybuffer',
    });
    return response.data;
  }

  // Budget endpoints
  async setBudget(payload: { month: number; year: number; total_limit: number }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/budgets', payload);
    return response.data;
  }

  async getCurrentBudget(params?: { month?: number; year?: number }): Promise<{ success: boolean; data: BudgetSummary | null }> {
    const response = await this.client.get('/api/budgets/current', { params });
    return response.data;
  }

  async getBudgetHistory(limit: number = 6): Promise<{ success: boolean; data: BudgetSummary[] }> {
    const response = await this.client.get('/api/budgets/history', { params: { limit } });
    return response.data;
  }

  async deleteBudget(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/api/budgets/${id}`);
    return response.data;
  }

  // Category budget endpoints
  async parseCategoryBudgets(
    text: string,
    month?: number,
    year?: number
  ): Promise<{ success: boolean; data: { items: { category: string; limit: number }[] } }> {
    const response = await this.client.post('/api/budgets/categories/parse', { text, month, year });
    return response.data;
  }

  async upsertCategoryBudgets(payload: {
    month: number;
    year: number;
    items: { category: string; limit: number }[];
  }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/budgets/categories', payload);
    return response.data;
  }

  async getCurrentCategoryBudgets(params?: {
    month?: number;
    year?: number;
  }): Promise<{ success: boolean; data: CategoryBudgetProgress[] }> {
    const response = await this.client.get('/api/budgets/categories/current', { params });
    return response.data;
  }

  async getCategorySummary(filters?: { startDate?: string; endDate?: string }): Promise<CategorySummaryResponse> {
    const response = await this.client.get<CategorySummaryResponse>('/api/expenses/summary', { params: filters });
    return response.data;
  }

  async getSimilarExpenses(
    id: string
  ): Promise<{ success: boolean; data: { similar: Array<Expense & { similarity: number }> } }> {
    const response = await this.client.get(`/api/expenses/${id}/similar`);
    return response.data;
  }

  // Insight endpoints
  async generateInsights(): Promise<GenerateInsightsResponse> {
    const response = await this.client.post<GenerateInsightsResponse>('/api/insights/generate');
    return response.data;
  }

  async getInsights(filters?: { type?: string; limit?: number }): Promise<InsightsResponse> {
    const response = await this.client.get<InsightsResponse>('/api/insights', { params: filters });
    return response.data;
  }

  async suggestCategory(description: string): Promise<{
    success: boolean;
    data: { suggestedCategories: Array<{ category: string; confidence: number; reason?: string }> };
  }> {
    try {
      const response = await this.client.get('/api/expenses/suggest-category', { params: { description } });
      return response.data;
    } catch {
      return { success: false, data: { suggestedCategories: [] } };
    }
  }
}

export const api = new ApiClient();

/** Extract a human-readable message from an API error. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Array<{ message: string }> } | undefined;
    if (data?.errors?.length) return data.errors.map((e) => e.message).join('\n');
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (!error.response) return 'Cannot reach server. Check your connection and API URL.';
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
