// Ported from client/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  profilePicture?: string | null;
  profilePictureUrl?: string | null;
  isPremium: boolean;
  createdAt: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
  currency?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface Expense {
  id: string;
  userId: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  confidence: number;
  rawInput: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParseExpenseRequest {
  rawInput: string;
}

export interface ParseExpenseResponse {
  success: boolean;
  message: string;
  data: {
    expenses: Expense[];
    needsReview: string[];
  };
}

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface ExpensesResponse {
  success: boolean;
  data: {
    expenses: Expense[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      page?: number;
      totalPages?: number;
      hasMore: boolean;
    };
  };
  cached: boolean;
}

export interface BudgetSummary {
  id?: string;
  month: number;
  year: number;
  total_limit: number;
  total_spent: number;
  remaining: number;
  percentage: number;
}

export interface CategoryBudgetProgress {
  month: number;
  year: number;
  category: string;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface UpdateExpenseRequest {
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  date?: string;
}

export interface CategorySummary {
  totalSpent: number;
  currency: string;
  byCategory: Record<string, number>;
  percentages: Record<string, string>;
  topCategories: string[];
  transactionCount: number;
}

export interface CategorySummaryResponse {
  success: boolean;
  data: CategorySummary;
  cached: boolean;
}

export interface Insight {
  id: string;
  userId: string;
  type: string;
  content: string;
  metadata: {
    summary?: CategorySummary;
    expenseCount?: number;
    period?: {
      start: string;
      end: string;
    };
  };
  period: string;
  createdAt: string;
}

export interface InsightsResponse {
  success: boolean;
  data: {
    insights: Insight[];
  };
  cached?: boolean;
}

export interface GenerateInsightsResponse {
  success: boolean;
  message: string;
  data: {
    insights: Insight[];
    summary: CategorySummary;
  };
}

// --- AI advisor / assistant ---

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AdvisorAnswer {
  answer: string;
  followUps: string[];
  remainingFreeQuestions: number | null;
}

export interface SavingsPlanStep {
  category: string;
  action: string;
  estimatedMonthlySaving: number;
}

export interface SavingsPlan {
  feasible: boolean;
  targetAmount: number;
  currency: string;
  estimatedTotalSaving: number;
  summary: string;
  steps: SavingsPlanStep[];
}

export interface SearchResultExpense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  matchType: 'semantic' | 'keyword' | 'both';
}

export interface ExpenseSearchResult {
  query: string;
  expenses: SearchResultExpense[];
  total: number;
  totalAmount: number;
  currency: string;
}

// --- Spending intelligence ---

export interface IntelligenceAnomaly {
  type: 'category_spike' | 'large_transaction';
  message: string;
  category?: string;
  amount?: number;
  currentAmount?: number;
}

export interface IntelligenceTrend {
  category: string;
  monthlyAmounts: number[];
  changePercent: number;
  currency: string;
  message: string;
}

export interface IntelligenceWaste {
  type: 'price_creep' | 'overlapping_subscriptions' | 'small_leak';
  category: string;
  amount: number;
  currency: string;
  message: string;
  items?: string[];
}

export interface SpendingIntelligence {
  currency: string;
  windowMonths: number;
  monthlySeries: Array<{ month: string; total: number; byCategory: Record<string, number> }>;
  anomalies: IntelligenceAnomaly[];
  trends: IntelligenceTrend[];
  waste: IntelligenceWaste[];
  recurring: Array<{
    description: string;
    category: string;
    averageAmount: number;
    currency: string;
    occurrences: number;
    monthsSeen: number;
    lastDate: string;
  }>;
}

// --- Weekly briefing ---

export interface BriefingContent {
  title: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
}

export interface BriefingInsight {
  id: string;
  type: 'briefing';
  content: string;
  metadata: {
    briefing: BriefingContent;
    weekTotal: number;
    previousWeekTotal: number;
    currency: string;
    period?: { start: string; end: string };
  };
  period: string;
  createdAt: string;
}

// --- Savings goals ---

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  currency: string;
  deadline: string | null;
  status: 'active' | 'completed' | 'archived';
  progress: number; // 0-1
  remaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Healthcare',
  'Education',
  'Personal Care',
  'Fees',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
