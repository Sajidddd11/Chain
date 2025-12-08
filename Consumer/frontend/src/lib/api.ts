import type {
  AuthResponse,
  NotificationItem,
  ConsumptionLog,
  DashboardData,
  Device,
  InventoryItem,
  RecommendedResource,
  Resource,
  UserProfile,
  ScanReceiptResponse,
  RecipeSuggestionRequest,
  Conversation,
  Message,
  WasteItem,
  WasteRecommendation,
  WastePickup,
  AgrisenseStatus,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown> | FormData;
  token?: string | null;
  headers?: Record<string, string>;
};

type CreateInventoryPayload = {
  foodItemId?: string;
  customName?: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string;
  purchasedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  price?: number | null;
};

type CreateUsagePayload = {
  inventoryItemId?: string;
  itemName?: string;
  category?: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  loggedAt?: string;
};

type UsageSuggestionRequest = {
  dishes: string[];
  servings?: number | null;
  audience?: string | null;
};

type UsageSuggestionResponse = {
  suggestions: Array<{
    inventory_item_id: string;
    amount_to_use: number;
  }>;
  missing_items: Array<{
    name: string;
    suggested_quantity?: string | null;
    note: string;
  }>;
};

type WasteAnalysisPayload = {
  itemName: string;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
};

type WasteAnalysisResponse = {
  message: string;
  recommendations: WasteRecommendation[];
  items: WasteItem[];
};

type ConsumptionPatternsResponse = {
  patterns: {
    dailyConsumption: Record<string, { total: number; categories: Record<string, number> }>;
    categoryConsumption: Record<string, number>;
    weeklyTrends: Record<string, { total: number; categories: Record<string, number> }>;
    totalConsumption: number;
    averageDaily: number;
  };
  wastePredictions: Array<{
    item: string;
    category: string;
    currentQuantity: number;
    unit: string;
    daysUntilExpiry: number;
    predictedConsumption: number;
    wasteRisk: number;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  insights: Array<{
    type: 'warning' | 'info';
    title: string;
    message: string;
    category: string;
  }>;
  period: {
    start: string;
    end: string;
    type: string;
  };
};

type HeatmapDataResponse = {
  heatmap: Array<{
    date: string;
    [category: string]: number | string;
  }>;
  categories: string[];
  period: {
    start: string;
    end: string;
    type: string;
  };
};

type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  householdSize?: number | null;
  dietaryPreferences?: string | null;
  budgetAmountBdt?: number | null;
  budgetPeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  childrenCount?: number | null;
  teenCount?: number | null;
  adultCount?: number | null;
  elderlyCount?: number | null;
  location?: string | null;
};

type UpdateProfilePayload = {
  fullName?: string;
  householdSize?: number | null;
  dietaryPreferences?: string | null;
  budgetAmountBdt?: number | null;
  budgetPeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  location?: string | null;
  phone?: string;
  childrenCount?: number | null;
  teenCount?: number | null;
  adultCount?: number | null;
  elderlyCount?: number | null;
};

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Request failed');
  }

  return response.json();
}

type ProfileResponse = { profile: UserProfile };
type DashboardResponse = DashboardData;
type InventoryResponse = { items: InventoryItem[] };
type LogsResponse = { logs: ConsumptionLog[] };
type ResourcesResponse = { resources: Resource[] };
type RecommendationsResponse = { recommendations: RecommendedResource[] };
type RecipeSuggestionResponse = {
  suggestions: Array<{
    title: string;
    description: string;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      priority: 'expiring-soon' | 'expiring-week' | 'fresh';
      expiryDays: number;
    }>;
    instructions: string[];
    prepTime: number;
    cookTime: number;
    servings: number;
    difficulty: 'Easy' | 'Medium' | 'Hard';
  }>;
};
type AlternativesResponse = {
  alternatives: Array<{
    product_id: string;
    name: string;
    category: string;
    price: number | null;
    unit?: string | null;
    description?: string | null;
    stock_quantity?: number | null;
    match_score: number;
    reason: string;
  }>;
};

type NotificationsResponse = { notifications: NotificationItem[] };

export const api = {
  login: (payload: Record<string, unknown>) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: payload }),
  register: (payload: RegisterPayload) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: payload }),
  getProfile: (token: string) => request<ProfileResponse>('/api/profile', { token }),
  updateProfile: (token: string, payload: UpdateProfilePayload) =>
    request<ProfileResponse>('/api/profile', { method: 'PUT', token, body: payload }),
  getDashboard: (token: string) => request<DashboardResponse>('/api/dashboard', { token }),
  getInventory: (token: string) => request<InventoryResponse>('/api/inventory', { token }),
  createInventoryItem: (token: string, payload: CreateInventoryPayload) =>
    request<{ item: InventoryItem }>('/api/inventory', { method: 'POST', token, body: payload }),
  updateInventoryItem: (token: string, id: string, payload: Partial<CreateInventoryPayload>) =>
    request<{ item: InventoryItem }>(`/api/inventory/${id}`, { method: 'PUT', token, body: payload }),
  updateMissingExpiryDates: (token: string) =>
    request<{ message: string }>('/api/inventory/update-expiry-dates', { method: 'POST', token }),
  deleteInventoryItem: (token: string, id: string) =>
    request<void>(`/api/inventory/${id}`, { method: 'DELETE', token }),
  getLogs: (token: string) => request<LogsResponse>('/api/logs', { token }),
  createLog: (token: string, payload: CreateUsagePayload) =>
    request<{ log: ConsumptionLog }>('/api/logs', { method: 'POST', token, body: payload }),
  requestUsagePlan: (token: string, payload: UsageSuggestionRequest) =>
    request<UsageSuggestionResponse>('/api/logs/suggest', { method: 'POST', token, body: payload }),
  getResources: () => request<ResourcesResponse>('/api/resources'),
  getRecommendedResources: (token: string) =>
    request<RecommendationsResponse>('/api/resources/recommended', { token }),
  uploadReceipt: (token: string, formData: FormData) =>
    request('/api/uploads', { method: 'POST', token, body: formData }),
  registerDevice: (token: string, apiKey: string, deviceName: string) =>
    request<{ device: Device }>('/api/devices/register', {
      method: 'POST',
      token,
      body: { apiKey, deviceName },
    }),
  listDevices: (token: string) => request<{ devices: Device[] }>('/api/devices', { token }),
  removeDevice: (token: string, deviceId: string) =>
    request<void>(`/api/devices/${deviceId}`, { method: 'DELETE', token }),
  scanReceipt: (token: string, formData: FormData) =>
    request<ScanReceiptResponse>('/api/uploads/scan-receipt', { method: 'POST', token, body: formData }),
  scanLeftovers: (token: string, formData: FormData) =>
    request<{ ingredients: string }>('/api/uploads/scan-leftovers', { method: 'POST', token, body: formData }),
  getRecipeSuggestions: (token: string, payload: RecipeSuggestionRequest) =>
    request<RecipeSuggestionResponse>('/api/recipes/suggest', { method: 'POST', token, body: payload }),
  getAlternatives: (
    token: string,
    itemName: string,
    options?: { category?: string | null; price?: number | null },
  ) => {
    const params = new URLSearchParams();
    if (options?.category) {
      params.append('category', options.category);
    }
    if (options?.price !== undefined && options?.price !== null && !Number.isNaN(options.price)) {
      params.append('price', String(options.price));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<AlternativesResponse>(
      `/api/inventory/alternatives/${encodeURIComponent(itemName)}${query}`,
      { token },
    );
  },
  getNotifications: (token: string) =>
    request<NotificationsResponse>('/api/notifications', { token }),
  markNotificationRead: (token: string, id: string) =>
    request<{ notification: NotificationItem }>(`/api/notifications/${id}/read`, {
      method: 'POST',
      token,
    }),
  markAllNotificationsRead: (token: string) =>
    request('/api/notifications/mark-all-read', { method: 'POST', token }),
  getWasteItems: (token: string) => request<{ items: WasteItem[] }>('/api/waste', { token }),
  analyzeWaste: (token: string, payload: WasteAnalysisPayload) =>
    request<WasteAnalysisResponse>('/api/waste/analyze', { method: 'POST', token, body: payload }),
  getWasteEstimations: (token: string) =>
    request<{
      estimations: {
        totalWasteGrams: number;
        estimatedMoneyWasted: number;
        weeklyProjection: number;
        monthlyProjection: number;
        topWasteCategories: Array<{
          category: string;
          grams: number;
          value: number;
          count: number;
        }>;
      };
      communityComparison: {
        comparison: 'below' | 'average' | 'above';
        percentageDiff: number;
        communityAverage: number;
        userAverage: number;
      };
      items: WasteItem[];
    }>('/api/waste/estimations', { token }),
  listWastePickups: (token: string) =>
    request<{ pickups: WastePickup[] }>('/api/waste/pickups', { token }),
  requestWastePickup: (token: string) =>
    request<{ pickup: WastePickup; rewardPoints: number; rewardTotal: number }>(
      '/api/waste/pickups/request',
      { method: 'POST', token },
    ),
  listAdminWastePickups: (token: string) =>
    request<{ pickups: WastePickup[] }>('/api/waste/admin/pickups', { token }),
  updateAdminPickupStatus: (token: string, pickupId: string, status: WastePickup['status']) =>
    request<{ pickup: WastePickup }>(`/api/waste/admin/pickups/${pickupId}/status`, {
      method: 'POST',
      token,
      body: { status },
    }),
  getAgrisenseStatus: (token: string) =>
    request<{ status: AgrisenseStatus }>('/api/waste/agrisense/status', { token }),
  toggleAgrisense: (token: string, enabled: boolean) =>
    request<{ message: string; status: AgrisenseStatus }>('/api/waste/agrisense/toggle', {
      method: 'POST',
      token,
      body: { enabled },
    }),
  // Donations
  listDonations: (token?: string, type?: 'human' | 'animal') => {
    const url = type ? `/api/donations?type=${type}` : '/api/donations';
    return request<{ donations: any[] }>(url, { token });
  },
  createDonation: (token: string, payload: any) => request('/api/donations', { method: 'POST', token, body: payload }),
  getDonation: (token: string | undefined, id: string) => request(`/api/donations/${id}`, { token }),
  deleteDonation: (token: string, id: string) => request(`/api/donations/${id}`, { method: 'DELETE', token }),
  getDonationRequests: (token: string, donationId: string) => request<{ requests: any[] }>(`/api/donations/${donationId}/requests`, { token }),
  createDonationRequest: (token: string, donationId: string, message: string) =>
    request<{ message: string; request?: any; conversation?: Conversation }>(`/api/donations/${donationId}/request`, { method: 'POST', token, body: { message } }),
  getMyDonationRequests: (token: string) => request<{ requests: any[] }>('/api/donations/requests/my', { token }),
  acceptDonationRequest: (token: string, requestId: string) =>
    request(`/api/donations/requests/${requestId}/accept`, { method: 'POST', token }),
  // Messaging
  getConversations: (token: string) => request<{ conversations: Conversation[] }>('/api/messages/conversations', { token }),
  getMessages: (token: string, convId: string) => request<{ messages: Message[] }>(`/api/messages/conversations/${convId}/messages`, { token }),
  sendMessage: (token: string, conversationId: string, content: string) =>
    request<{ message: string; data?: Message }>('/api/messages', { method: 'POST', token, body: { conversation_id: conversationId, content } }),
  // Chatbot
  sendChatbotMessage: (token: string, message: string, history?: Array<{ role: string; content: string; image?: string }>, image?: string) =>
    request<{ response: string }>('/api/chatbot/message', { method: 'POST', token, body: { message, history: history || [], image } }),
  getChatbotHistory: (token: string) =>
    request<{ messages: Message[] }>('/api/chatbot/history', { token }),
  // Analytics
  getConsumptionPatterns: (token: string, period?: string) =>
    request<ConsumptionPatternsResponse>(`/api/analytics/patterns${period ? `?period=${period}` : ''}`, { token }),
  getHeatmapData: (token: string, period?: string) =>
    request<HeatmapDataResponse>(`/api/analytics/heatmap${period ? `?period=${period}` : ''}`, { token }),
  // SDG Impact Scoring
  getSDGScore: (token: string) =>
    request<{
      score: number;
      breakdown: {
        wasteReduction: number;
        nutrition: number;
        inventoryEfficiency: number;
      };
      weeklyImprovement: number;
      insights: {
        weeklyInsight: string;
        topStrength: string;
        topWeakness: string;
        actionableSteps: string[];
        scoreImpact: string[];
      };
      categoryBreakdown: Array<{
        category: string;
        count: number;
        quantity: number;
      }>;
    }>('/api/sdg/score', { token }),
  getSDGHistory: (token: string, period?: string) =>
    request<{
      history: Array<{
        score: number;
        breakdown: {
          wasteReduction: number;
          nutrition: number;
          inventoryEfficiency: number;
        };
        insights: any;
        date: string;
      }>;
    }>(`/api/sdg/history${period ? `?period=${period}` : ''}`, { token }),
  // Nutrient Gap Analysis
  getNutrientAnalysis: (token: string) =>
    request<{
      nutrients: Array<{
        name: string;
        percentage: number;
        status: 'good' | 'warning' | 'critical';
        dailyValue: string;
      }>;
      deficiencies: Array<{
        nutrient: string;
        severity: 'high' | 'medium' | 'low';
        reason: string;
        icon: string;
      }>;
      foodSuggestions: Array<{
        name: string;
        priority: 'high' | 'medium' | 'low';
        nutrients: string[];
        description: string;
        servingSize: string;
        impact: string;
      }>;
      mealSuggestions: Array<{
        name: string;
        description: string;
        nutrients: string[];
        difficulty: string;
      }>;
      overallScore: number;
      analyzedAt: string;
      cached?: boolean;
      cacheAge?: number;
    }>('/api/nutrition/analyze', { token }),
  // Clear nutrient analysis cache (call this when consumption logs are added/updated)
  clearNutrientCache: (token: string) => {
    const CACHE_KEY = `nutrient_analysis_${token}`;
    localStorage.removeItem(CACHE_KEY);
  },
  // Clear SDG score cache (call this when consumption or waste logs are added/updated)
  clearSDGCache: (token: string) => {
    const CACHE_KEY = `sdg_score_${token}`;
    localStorage.removeItem(CACHE_KEY);
  },
  // AppLink Subscription
  getSubscriptionStatus: (token: string) =>
    request<{
      subscribed: boolean;
      subscriptionStatus?: string | null;
      subscribedAt?: string | null;
      unsubscribedAt?: string | null;
      hasPhone: boolean;
      applinkConfigured?: boolean;
    }>('/api/subscription/status', { token }),
  subscribe: (token: string) =>
    request<{
      message: string;
      subscribed: boolean;
      subscriptionStatus?: string | null;
      subscribedAt?: string | null;
    }>('/api/subscription/subscribe', { method: 'POST', token }),
  unsubscribe: (token: string) =>
    request<{
      message: string;
      subscribed: boolean;
      subscriptionStatus?: string | null;
      unsubscribedAt?: string | null;
    }>('/api/subscription/unsubscribe', { method: 'POST', token }),
};
