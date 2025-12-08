import { supabase } from '../config/supabaseClient.js';

const DEVICES_TABLE = 'devices';

export const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({ message: 'API key is required' });
  }

  if (!supabase) {
    return res.status(500).json({ message: 'Supabase client is not configured' });
  }

  try {
    const { data: device, error } = await supabase
      .from(DEVICES_TABLE)
      .select('id, user_id, device_name, api_key')
      .eq('api_key', apiKey)
      .single();

    if (error || !device) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    // Update last_seen_at
    await supabase
      .from(DEVICES_TABLE)
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', device.id);

    // Attach device info to request (similar to req.user for JWT)
    req.device = {
      deviceId: device.id,
      userId: device.user_id,
      deviceName: device.device_name,
    };

    next();
  } catch (error) {
    console.error('apiKeyAuth error', error);
    return res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
};

