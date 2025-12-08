export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role?: 'user' | 'admin';
  household_size?: number | null;
  household_children?: number | null;
  household_teens?: number | null;
  household_adults?: number | null;
  household_elderly?: number | null;
  dietary_preferences?: string | null;
  budget_amount_bdt?: number | null;
  budget_period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  location?: string | null;
  reward_points?: number | null;
  applink_subscribed?: boolean | null;
  applink_subscription_status?: string | null;
  applink_subscribed_at?: string | null;
  applink_unsubscribed_at?: string | null;
};

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    role?: 'user' | 'admin';
    householdSize?: number | null;
    householdChildren?: number | null;
    householdTeens?: number | null;
    householdAdults?: number | null;
    householdElderly?: number | null;
    dietaryPreferences?: string | null;
    budgetAmountBdt?: number | null;
    budgetPeriod?: 'daily' | 'weekly' | 'monthly' | null;
    location?: string | null;
    rewardPoints?: number | null;
    applinkSubscribed?: boolean | null;
    applinkSubscriptionStatus?: string | null;
  };
};

export type DashboardData = {
  totals: {
    inventory: number;
    expiringSoon: number;
    recentLogs: number;
  };
  inventoryPreview: Array<{
    id: string;
    custom_name: string | null;
    expires_at: string | null;
  }>;
  recentLogs: Array<{
    id: string;
    item_name: string;
    category: string;
    logged_at: string;
  }>;
  recommendedResources: Array<{
    id: string;
    title: string;
    category: string;
    resource_type: string;
    description?: string;
  }>;
  budgetUsage?: {
    budgetAmount: number;
    used: number;
    remaining: number;
    percentage: number;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    periodLabel: string;
    since: string;
  } | null;
};

export type InventoryItem = {
  id: string;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  category: string;
  expires_at: string | null;
  purchased_at?: string | null;
  notes: string | null;
  food_item?: {
    name: string;
    category: string;
  } | null;
};

export type ConsumptionLog = {
  id: string;
  inventory_item_id?: string | null;
  item_name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  logged_at: string;
};

export type Resource = {
  id: string;
  title: string;
  description?: string | null;
  url?: string | null;
  category: string;
  resource_type: string;
};

export type RecommendedResource = Resource & { reason?: string };

export type ScanReceiptResponse = {
  message: string;
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    category: string;
    price?: number | null;
    expiresAt?: string | null;
  }>;
  upload: {
    id: string;
    filename: string;
  };
};

export type RecipeSuggestionRequest = {
  query?: string;
  cuisine?: string;
};

export type RecipeSuggestionResponse = {
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

export type RecommendationsResponse = {
  recommendations: RecommendedResource[];
};

export type Device = {
  id: string;
  api_key: string;
  device_name: string | null;
  created_at: string;
  last_seen_at: string | null;
};

export type CreateDonationPayload = {
  title: string;
  description?: string;
  quantity?: number | null;
  unit?: string | null;
  pickup_instructions?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  available_from?: string | null;
  expires_at?: string | null;
  donation_type?: 'human' | 'animal';
};

export type Donation = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  quantity?: number | null;
  unit?: string | null;
  pickup_instructions?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  status?: 'available' | 'pending' | 'claimed';
  donation_type?: 'human' | 'animal';
  created_at?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  donation_id?: string | null;
  participants?: string[] | null;
  created_at?: string;
  updated_at?: string;
  donations?: {
    title: string;
    description?: string;
  };
  lastMessage?: {
    content: string;
    created_at: string;
    sender: {
      id: string;
      full_name: string;
    };
  };
  unreadCount?: number;
  otherParticipants?: Array<{
    id: string;
    full_name: string;
  }>;
  lastActivity?: string;
  messagePreview?: {
    content: string;
    sender: {
      id: string;
      full_name: string;
    };
    time: string;
  };
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender?: { id: string; full_name: string } | null;
  content: string;
  created_at?: string;
  message_reads?: Array<{
    user_id: string;
    read_at: string;
  }>;
};

export type WasteItem = {
  id: string;
  user_id?: string;
  material_name: string;
  quantity_value: number;
  quantity_unit?: string | null;
  source_item_name?: string | null;
  source_category?: string | null;
  last_source_quantity?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type WasteRecommendation = {
  name: string;
  quantity_value: number;
  quantity_unit?: string | null;
  action: 'new' | 'add';
};

export type WastePickup = {
  id: string;
  user_id: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  total_items: number;
  total_quantity?: number | null;
  total_weight_grams?: number | null;
  reward_points: number;
  waste_snapshot: WasteItem[];
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_location?: string | null;
  notes?: string | null;
  requested_at?: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
  } | null;
};

export type AgrisenseStatus = {
  interested: boolean;
  enabled: boolean;
  phone: string | null;
  lastSyncedAt: string | null;
  farmer?: {
    id?: string;
    full_name?: string;
    mobile_number?: string;
    stock_waste?: boolean;
  } | null;
  remoteWasteCount: number;
  statusNote?: string | null;
};

