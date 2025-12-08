import { supabase } from '../config/supabaseClient.js';
import { sendPushNotification } from '../services/pushNotificationService.js';

const NOTIFICATIONS_TABLE = 'notifications';
const PUSH_SUBSCRIPTIONS_TABLE = 'push_subscriptions';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

const normalizeMetadata = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return { raw: String(value) };
  }
};

export const createDeviceNotification = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.device?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Device authentication required' });
  }

  const {
    title = 'Device alert',
    body = 'Your Foodprint device sent an alert.',
    metadata = {},
  } = req.body || {};

  try {
    const { data, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .insert({
        user_id: userId,
        title,
        body,
        metadata: normalizeMetadata(metadata),
      })
      .select('*')
      .single();

    if (error) throw error;

    // Send push notification if user has push subscription
    try {
      await sendPushNotification(userId, {
        title: title,
        body: body,
        data: { notificationId: data.id, type: 'device_alert' },
      });
    } catch (pushError) {
      console.error('Failed to send push notification:', pushError);
      // Don't fail the request if push notification fails
    }

    return res.status(201).json({ notification: data });
  } catch (error) {
    console.error('createDeviceNotification error', error);
    return res.status(500).json({ message: 'Failed to create notification', error: error.message });
  }
};

export const listNotifications = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User authentication required' });
  }

  const { unreadOnly } = req.query;

  try {
    let query = supabase
      .from(NOTIFICATIONS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ notifications: data || [] });
  } catch (error) {
    console.error('listNotifications error', error);
    return res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ message: 'User authentication required' });
  }

  try {
    const { data, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;

    return res.json({ notification: data });
  } catch (error) {
    console.error('markNotificationRead error', error);
    return res.status(500).json({ message: 'Failed to update notification', error: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'User authentication required' });
  }

  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('markAllNotificationsRead error', error);
    return res.status(500).json({ message: 'Failed to update notifications', error: error.message });
  }
};

export const subscribeToPushNotifications = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User authentication required' });
  }

  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ message: 'Valid subscription object required' });
  }

  try {
    // First, remove any existing subscriptions for this user
    await supabase
      .from(PUSH_SUBSCRIPTIONS_TABLE)
      .delete()
      .eq('user_id', userId);

    // Insert the new subscription
    const { data, error } = await supabase
      .from(PUSH_SUBSCRIPTIONS_TABLE)
      .insert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys?.p256dh,
        auth_key: subscription.keys?.auth,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({ 
      message: 'Push notification subscription saved successfully',
      subscription: data 
    });
  } catch (error) {
    console.error('subscribeToPushNotifications error', error);
    return res.status(500).json({ message: 'Failed to save push subscription', error: error.message });
  }
};

export const getVapidPublicKey = async (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(500).json({ message: 'VAPID public key not configured' });
  }

  return res.json({ publicKey });
};

export default {
  createDeviceNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToPushNotifications,
  getVapidPublicKey,
};

