// Ported from client/lib/api.ts for React Native (token in SecureStore, in-memory cache)
import axios, { AxiosError, AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type {
  AdvisorAnswer,
  AuthResponse,
  BriefingInsight,
  BudgetSummary,
  CategoryBudgetProgress,
  CategorySummaryResponse,
  ChatTurn,
  Expense,
  ExpenseFilters,
  ExpenseSearchResult,
  ExpensesResponse,
  GenerateInsightsResponse,
  Goal,
  InsightsResponse,
  LoginRequest,
  ParseExpenseRequest,
  ParseExpenseResponse,
  SavingsPlan,
  SignupRequest,
  SpendingIntelligence,
  UpdateExpenseRequest,
} from './types';

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'thoughtexpense_token';
const BASE_URL_KEY = 'thoughtexpense_base_url';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7100';

/** Login failures, anonymous polls, and stale parse-job checks must not wipe the session. */
function shouldClearSessionOn401(error: AxiosError): boolean {
  if (error.response?.status !== 401) return false;
  const url = error.config?.url || '';
  if (url.includes('/api/auth/login') || url.includes('/api/auth/signup')) return false;
  if (url.includes('/parse/jobs/')) return false;
  const header = error.config?.headers?.Authorization;
  const auth = typeof header === 'string' ? header : Array.isArray(header) ? header[0] : '';
  if (!auth) return false;
  return true;
}

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
        if (shouldClearSessionOn401(error)) {
          await this.clearToken();
          onUnauthorized?.();
        }
        return Promise.reject(error);
      }
    );
  }

  // Base URL management (runtime-overridable so a wrong baked-in URL isn't fatal)
  getBaseUrl(): string {
    return this.client.defaults.baseURL || API_BASE_URL;
  }

  async setBaseUrl(url: string): Promise<void> {
    const cleaned = url.trim().replace(/\/+$/, '');
    this.client.defaults.baseURL = cleaned || API_BASE_URL;
    try {
      if (cleaned && cleaned !== API_BASE_URL) {
        await AsyncStorage.setItem(BASE_URL_KEY, cleaned);
      } else {
        await AsyncStorage.removeItem(BASE_URL_KEY);
      }
    } catch {
      // in-memory only fallback
    }
  }

  /** Load a persisted base-URL override. Call once at app start, before requests. */
  async loadBaseUrl(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem(BASE_URL_KEY);
      if (stored) this.client.defaults.baseURL = stored;
    } catch {
      // keep default
    }
    return this.getBaseUrl();
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

  async verifyResetOtp(email: string, otp: string): Promise<{ success: boolean; data?: { resetToken: string } }> {
    const response = await this.client.post('/api/auth/verify-otp', { email, otp });
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

  /** Permanently delete the account (password-confirmed). Clears the local session. */
  async deleteAccount(password: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete('/api/auth/account', { data: { password } });
    if (response.data?.success) {
      await this.clearToken();
    }
    return response.data;
  }

  async logout(): Promise<void> {
    await this.clearToken();
  }

  /** OCR a receipt image on the server (Premium). Returns raw expense text. */
  async ocrReceipt(
    uri: string,
    mimeType?: string,
    fileName?: string
  ): Promise<{ success: boolean; data: { text: string } }> {
    const formData = new FormData();
    formData.append('image', {
      uri,
      name: fileName || 'receipt.jpg',
      type: mimeType || 'image/jpeg',
    } as unknown as Blob);
    const response = await this.client.post('/api/expenses/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  }

  // Expense endpoints
  async parseExpenses(data: ParseExpenseRequest & { create?: boolean }): Promise<ParseExpenseResponse> {
    const response = await this.client.post<ParseExpenseResponse>('/api/expenses/parse', data);
    return response.data;
  }

  async enqueueParseExpenses(
    data: ParseExpenseRequest & {
      create?: boolean;
      localPreview?: Array<{
        description: string;
        amount: number;
        currency?: string;
        category?: string;
        date?: string;
        rawInput?: string;
      }>;
      clientBatchId?: string;
    },
    idempotencyKey?: string
  ): Promise<{ success: boolean; message: string; data: { jobId: string } }> {
    const response = await this.client.post('/api/expenses/parse/async', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
    return response.data;
  }

  async getParseJobStatus(
    jobId: string
  ): Promise<{ success: boolean; data: { jobId: string; status: string; result?: unknown; error?: string } }> {
    const response = await this.client.get(`/api/expenses/parse/jobs/${jobId}`);
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

  /** Create many expenses in ONE request (avoids per-item rate-limit pressure). */
  async createExpensesBatch(
    expenses: Array<{
      description: string;
      amount: number;
      currency?: string;
      category?: string;
      date?: string;
      rawInput?: string;
    }>
  ): Promise<{ success: boolean; message: string; data: { expenses: Expense[] } }> {
    const response = await this.client.post('/api/expenses/batch', { expenses });
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

  async getRecurringExpenses(): Promise<{
    success: boolean;
    data: {
      recurring: Array<{
        description: string;
        category: string;
        averageAmount: number;
        currency: string;
        occurrences: number;
        monthsSeen: number;
        lastDate: string;
      }>;
      windowMonths: number;
    };
  }> {
    const response = await this.client.get('/api/expenses/recurring');
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

  async getIntelligence(): Promise<{ success: boolean; data: SpendingIntelligence }> {
    const response = await this.client.get('/api/insights/intelligence');
    return response.data;
  }

  async getLatestBriefing(): Promise<{ success: boolean; data: { briefing: BriefingInsight | null } }> {
    const response = await this.client.get('/api/insights/briefing/latest');
    return response.data;
  }

  async generateBriefing(): Promise<{ success: boolean; message?: string; data: { briefing: BriefingInsight | null } }> {
    const response = await this.client.post('/api/insights/briefing/generate', {}, { timeout: 120000 });
    return response.data;
  }

  // Assistant endpoints
  async askAssistant(question: string, history: ChatTurn[] = []): Promise<{ success: boolean; data: AdvisorAnswer }> {
    const response = await this.client.post('/api/assistant/ask', { question, history }, { timeout: 120000 });
    return response.data;
  }

  async askWhySpendingChanged(): Promise<{ success: boolean; data: AdvisorAnswer }> {
    const response = await this.client.post('/api/assistant/why', {}, { timeout: 120000 });
    return response.data;
  }

  async getSavingsPlan(
    targetAmount: number
  ): Promise<{ success: boolean; data: { plan: SavingsPlan; remainingFreeQuestions: number | null } }> {
    const response = await this.client.post('/api/assistant/savings-plan', { targetAmount }, { timeout: 120000 });
    return response.data;
  }

  async searchExpenses(q: string): Promise<{ success: boolean; data: ExpenseSearchResult }> {
    const response = await this.client.get('/api/assistant/search', { params: { q }, timeout: 60000 });
    return response.data;
  }

  // Goal endpoints
  async getGoals(): Promise<{ success: boolean; data: { goals: Goal[] } }> {
    const response = await this.client.get('/api/goals');
    return response.data;
  }

  async createGoal(payload: {
    name: string;
    targetAmount: number;
    currency?: string;
    deadline?: string;
  }): Promise<{ success: boolean; message: string; data: { goal: Goal } }> {
    const response = await this.client.post('/api/goals', payload);
    return response.data;
  }

  async updateGoal(
    id: string,
    payload: { name?: string; targetAmount?: number; deadline?: string | null; status?: string }
  ): Promise<{ success: boolean; message: string; data: { goal: Goal } }> {
    const response = await this.client.patch(`/api/goals/${id}`, payload);
    return response.data;
  }

  async contributeToGoal(
    id: string,
    amount: number
  ): Promise<{ success: boolean; message: string; data: { goal: Goal } }> {
    const response = await this.client.post(`/api/goals/${id}/contribute`, { amount });
    return response.data;
  }

  async deleteGoal(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/api/goals/${id}`);
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
    if (!error.response) return `Cannot reach server at ${api.getBaseUrl()}. Check your connection, or change the server URL in Device Settings.`;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
