import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';

const USERS_TABLE = 'users';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }

  if (!process.env.JWT_SECRET) {
    res.status(500).json({ message: 'JWT secret is not configured' });
    return false;
  }
  return true;
};

const parseCount = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
};

const normalizeBudgetPeriod = (value) => {
  const allowed = ['daily', 'weekly', 'monthly'];
  return allowed.includes(value) ? value : 'monthly';
};

export const registerUser = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const {
    fullName,
    email,
    password,
    householdSize,
    dietaryPreferences,
    budgetAmountBdt,
    budgetPeriod,
    location,
    phone,
    childrenCount,
    teenCount,
    adultCount,
    elderlyCount,
  } = req.body;

  if (!fullName || !email || !password || !phone) {
    return res.status(400).json({ message: 'Full name, email, phone, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  const phoneRegex = /^\+8801\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ message: 'Phone number must follow +8801XXXXXXXXX format' });
  }

  const budgetAmountNumber =
    budgetAmountBdt === undefined || budgetAmountBdt === null || budgetAmountBdt === ''
      ? null
      : Number(budgetAmountBdt);

  if (budgetAmountNumber !== null && (Number.isNaN(budgetAmountNumber) || budgetAmountNumber < 0)) {
    return res.status(400).json({ message: 'Budget amount must be a positive number' });
  }

  try {
    const { data: existingUser, error: existingError } = await supabase
      .from(USERS_TABLE)
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertError } = await supabase
      .from(USERS_TABLE)
      .insert({
        full_name: fullName,
        email,
        password_hash: passwordHash,
        phone,
        household_size: householdSize,
        household_children: parseCount(childrenCount),
        household_teens: parseCount(teenCount),
        household_adults: parseCount(adultCount),
        household_elderly: parseCount(elderlyCount),
        dietary_preferences: dietaryPreferences,
        budget_amount_bdt: budgetAmountNumber,
        budget_period: normalizeBudgetPeriod(budgetPeriod),
        location,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        fullName: newUser.full_name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role || 'user',
        householdSize: newUser.household_size,
        householdChildren: newUser.household_children,
        householdTeens: newUser.household_teens,
        householdAdults: newUser.household_adults,
        householdElderly: newUser.household_elderly,
        dietaryPreferences: newUser.dietary_preferences,
        budgetAmountBdt: newUser.budget_amount_bdt,
        budgetPeriod: newUser.budget_period,
        location: newUser.location,
        rewardPoints: newUser.reward_points ?? 0,
        applinkSubscribed: newUser.applink_subscribed ?? false,
        applinkSubscriptionStatus: newUser.applink_subscription_status,
      },
    });
  } catch (error) {
    console.error('registerUser error', error);
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

export const loginUser = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const { data: user, error } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      throw error;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role || 'user',
        householdSize: user.household_size,
        householdChildren: user.household_children,
        householdTeens: user.household_teens,
        householdAdults: user.household_adults,
        householdElderly: user.household_elderly,
        dietaryPreferences: user.dietary_preferences,
        budgetAmountBdt: user.budget_amount_bdt,
        budgetPeriod: user.budget_period,
        location: user.location,
        rewardPoints: user.reward_points ?? 0,
        applinkSubscribed: user.applink_subscribed ?? false,
        applinkSubscriptionStatus: user.applink_subscription_status,
      },
    });
  } catch (error) {
    console.error('loginUser error', error);
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

