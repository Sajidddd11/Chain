import { supabase } from '../config/supabaseClient.js';

const DEVICES_TABLE = 'devices';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

export const registerDevice = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { apiKey, deviceName } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'User authentication required' });
  }

  if (!apiKey) {
    return res.status(400).json({ message: 'API key is required' });
  }

  if (!deviceName || deviceName.trim().length === 0) {
    return res.status(400).json({ message: 'Device name is required' });
  }

  try {
    // Check if API key already exists
    const { data: existingDevice, error: checkError } = await supabase
      .from(DEVICES_TABLE)
      .select('id, user_id')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingDevice) {
      if (existingDevice.user_id === userId) {
        // Already registered to this user, update name if needed
        const { data, error } = await supabase
          .from(DEVICES_TABLE)
          .update({ device_name: deviceName.trim(), last_seen_at: new Date().toISOString() })
          .eq('id', existingDevice.id)
          .select('id, api_key, device_name, created_at, last_seen_at')
          .single();

        if (error) throw error;
        return res.json({ device: data });
      } else {
        return res.status(409).json({ message: 'API key is already registered to another user' });
      }
    }

    // Register new device
    const { data, error } = await supabase
      .from(DEVICES_TABLE)
      .insert({
        user_id: userId,
        api_key: apiKey,
        device_name: deviceName.trim(),
        last_seen_at: new Date().toISOString(),
      })
      .select('id, api_key, device_name, created_at, last_seen_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ device: data });
  } catch (error) {
    console.error('registerDevice error', error);
    return res.status(500).json({ message: 'Failed to register device', error: error.message });
  }
};

export const listDevices = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'User authentication required' });
  }

  try {
    const { data, error } = await supabase
      .from(DEVICES_TABLE)
      .select('id, api_key, device_name, created_at, last_seen_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ devices: data || [] });
  } catch (error) {
    console.error('listDevices error', error);
    return res.status(500).json({ message: 'Failed to fetch devices', error: error.message });
  }
};

export const removeDevice = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'User authentication required' });
  }

  try {
    // Verify device belongs to user before deleting
    const { data: device, error: checkError } = await supabase
      .from(DEVICES_TABLE)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (checkError || !device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const { error } = await supabase.from(DEVICES_TABLE).delete().eq('id', id).eq('user_id', userId);

    if (error) throw error;

    return res.status(204).send();
  } catch (error) {
    console.error('removeDevice error', error);
    return res.status(500).json({ message: 'Failed to remove device', error: error.message });
  }
};

export const checkUsageToday = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.device?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Device authentication required' });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    const { data, error } = await supabase
      .from('consumption_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('logged_at', todayStart)
      .limit(1);

    if (error) throw error;

    const hasUsageToday = (data?.length || 0) > 0;

    return res.json({ hasUsageToday });
  } catch (error) {
    console.error('checkUsageToday error', error);
    return res.status(500).json({ message: 'Failed to check usage', error: error.message });
  }
};

