import { getUserId } from '../middleware/flexibleAuth.js';
import {
  analyzeUsageAndSyncWaste,
  getWasteItemsForUser,
  getWasteEstimations,
  getAgrisenseStatusForUser,
  toggleAgrisenseIntegration,
  listWastePickupsForUser,
  requestWastePickup,
  listWastePickupsForAdmin,
  updateWastePickupStatus,
} from '../services/wasteService.js';
import { supabase } from '../config/supabaseClient.js';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

export const listWasteItems = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const items = await getWasteItemsForUser(userId);
    return res.json({ items });
  } catch (error) {
    console.error('listWasteItems error', error);
    return res.status(500).json({ message: 'Failed to fetch waste items', error: error.message });
  }
};

export const analyzeWaste = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  const { itemName, category, quantity, unit } = req.body || {};
  if (!itemName) {
    return res.status(400).json({ message: 'itemName is required' });
  }

  try {
    const { recommendations, items } = await analyzeUsageAndSyncWaste(userId, {
      itemName,
      category,
      quantity: quantity !== undefined && quantity !== null ? Number(quantity) : null,
      unit,
    });

    return res.json({
      message: 'Waste intelligence updated',
      recommendations,
      items,
    });
  } catch (error) {
    console.error('analyzeWaste error', error);
    return res.status(500).json({ message: 'Failed to run waste analysis', error: error.message });
  }
};

export const fetchWasteEstimations = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const result = await getWasteEstimations(userId);
    return res.json(result);
  } catch (error) {
    console.error('fetchWasteEstimations error', error);
    return res.status(500).json({ message: 'Failed to fetch waste estimations', error: error.message });
  }
};

export const fetchAgrisenseStatus = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const status = await getAgrisenseStatusForUser(userId);
    return res.json({ status });
  } catch (error) {
    console.error('fetchAgrisenseStatus error', error);
    const statusCode = error?.statusCode || 500;
    return res
      .status(statusCode)
      .json({ message: error?.message || 'Failed to fetch Agrisense status' });
  }
};

export const updateAgrisenseToggle = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled flag is required' });
  }

  try {
    const result = await toggleAgrisenseIntegration(userId, enabled);
    return res.json(result);
  } catch (error) {
    console.error('updateAgrisenseToggle error', error);
    const statusCode = error?.statusCode || 500;
    return res
      .status(statusCode)
      .json({ message: error?.message || 'Failed to update Agrisense integration' });
  }
};

export const listUserPickups = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const pickups = await listWastePickupsForUser(userId, { limit: 20 });
    return res.json({ pickups });
  } catch (error) {
    console.error('listUserPickups error', error);
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({ message: error?.message || 'Failed to load pickups' });
  }
};

export const createPickupRequest = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const result = await requestWastePickup(userId);
    return res.status(201).json(result);
  } catch (error) {
    console.error('createPickupRequest error', error);
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({ message: error?.message || 'Failed to request pickup' });
  }
};

export const adminListPickups = async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const pickups = await listWastePickupsForAdmin();
    return res.json({ pickups });
  } catch (error) {
    console.error('adminListPickups error', error);
    return res.status(500).json({ message: 'Failed to load waste pickups', error: error.message });
  }
};

export const adminUpdatePickup = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const { status } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: 'Pickup ID is required' });
  }
  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  try {
    const pickup = await updateWastePickupStatus(id, status, req.user?.id);
    return res.json({ pickup });
  } catch (error) {
    console.error('adminUpdatePickup error', error);
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({ message: error?.message || 'Failed to update pickup' });
  }
};


