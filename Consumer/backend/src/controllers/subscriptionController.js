import { supabase } from '../config/supabaseClient.js';
import { subscribeUser, unsubscribeUser, isAppLinkConfigured } from '../services/applinkService.js';

const USERS_TABLE = 'users';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

/**
 * Subscribe user to AppLink services
 */
export const subscribe = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user.id;

  try {
    // Get user's phone number
    const { data: user, error: userError } = await supabase
      .from(USERS_TABLE)
      .select('phone')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    if (!user?.phone) {
      return res.status(400).json({ 
        message: 'Phone number is required for subscription. Please add a phone number to your profile.' 
      });
    }

    // Check if AppLink is configured
    if (!isAppLinkConfigured()) {
      console.warn('⚠️  AppLink credentials not configured. Subscription will be saved locally only.');
    }

    // Call AppLink API to subscribe
    const applinkResponse = await subscribeUser(user.phone);

    if (!applinkResponse.success) {
      return res.status(400).json({
        message: applinkResponse.statusDetail || 'Failed to subscribe',
        statusCode: applinkResponse.statusCode,
      });
    }

    // Update user subscription status in database
    const { data: updatedUser, error: updateError } = await supabase
      .from(USERS_TABLE)
      .update({
        applink_subscribed: true,
        applink_subscription_status: applinkResponse.subscriptionStatus || 'REGISTERED',
        applink_subscribed_at: new Date().toISOString(),
        applink_unsubscribed_at: null,
      })
      .eq('id', userId)
      .select(`
        id,
        applink_subscribed,
        applink_subscription_status,
        applink_subscribed_at
      `)
      .single();

    if (updateError) throw updateError;

    return res.json({
      message: 'Successfully subscribed to AppLink services',
      subscribed: true,
      subscriptionStatus: updatedUser.applink_subscription_status,
      subscribedAt: updatedUser.applink_subscribed_at,
    });
  } catch (error) {
    console.error('subscribe error', error);
    return res.status(500).json({ 
      message: 'Failed to subscribe', 
      error: error.message 
    });
  }
};

/**
 * Unsubscribe user from AppLink services
 */
export const unsubscribe = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user.id;

  try {
    // Get user's phone number
    const { data: user, error: userError } = await supabase
      .from(USERS_TABLE)
      .select('phone')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    if (!user?.phone) {
      return res.status(400).json({ 
        message: 'Phone number is required for unsubscription.' 
      });
    }

    // Check if AppLink is configured
    if (!isAppLinkConfigured()) {
      console.warn('⚠️  AppLink credentials not configured. Unsubscription will be saved locally only.');
    }

    // Call AppLink API to unsubscribe
    const applinkResponse = await unsubscribeUser(user.phone);

    if (!applinkResponse.success) {
      return res.status(400).json({
        message: applinkResponse.statusDetail || 'Failed to unsubscribe',
        statusCode: applinkResponse.statusCode,
      });
    }

    // Update user subscription status in database
    const { data: updatedUser, error: updateError } = await supabase
      .from(USERS_TABLE)
      .update({
        applink_subscribed: false,
        applink_subscription_status: applinkResponse.subscriptionStatus || 'UNREGISTERED',
        applink_unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(`
        id,
        applink_subscribed,
        applink_subscription_status,
        applink_unsubscribed_at
      `)
      .single();

    if (updateError) throw updateError;

    return res.json({
      message: 'Successfully unsubscribed from AppLink services',
      subscribed: false,
      subscriptionStatus: updatedUser.applink_subscription_status,
      unsubscribedAt: updatedUser.applink_unsubscribed_at,
    });
  } catch (error) {
    console.error('unsubscribe error', error);
    return res.status(500).json({ 
      message: 'Failed to unsubscribe', 
      error: error.message 
    });
  }
};

/**
 * Get user subscription status
 */
export const getSubscriptionStatus = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user.id;

  try {
    const { data: user, error } = await supabase
      .from(USERS_TABLE)
      .select(`
        id,
        applink_subscribed,
        applink_subscription_status,
        applink_subscribed_at,
        applink_unsubscribed_at,
        phone
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;

    return res.json({
      subscribed: user.applink_subscribed || false,
      subscriptionStatus: user.applink_subscription_status,
      subscribedAt: user.applink_subscribed_at,
      unsubscribedAt: user.applink_unsubscribed_at,
      hasPhone: !!user.phone,
      applinkConfigured: isAppLinkConfigured(),
    });
  } catch (error) {
    console.error('getSubscriptionStatus error', error);
    return res.status(500).json({ 
      message: 'Failed to get subscription status', 
      error: error.message 
    });
  }
};

/**
 * Validate webhook endpoint (for AppLink URL validation)
 * AppLink may send a GET or POST request to validate the URL
 */
export const validateWebhook = async (req, res) => {
  // Return success for validation requests - must match AppLink expected format
  return res.status(200).json({
    statusCode: 'S1000',
    statusDetail: 'Request was successfully processed',
  });
};

/**
 * Handle AppLink subscription notification webhook
 * This endpoint is called by AppLink when subscription status changes
 */
export const handleSubscriptionNotification = async (req, res) => {
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle empty POST requests (AppLink validation)
  if (req.method === 'POST' && (!req.body || Object.keys(req.body).length === 0)) {
    return res.status(200).json({
      statusCode: 'S1000',
      statusDetail: 'Request was successfully processed',
    });
  }

  // For validation, don't require Supabase
  if (!req.body || !req.body.subscriberId) {
    return res.status(200).json({
      statusCode: 'S1000',
      statusDetail: 'Request was successfully processed',
    });
  }

  if (!ensureSupabase(res)) return;

  try {
    const {
      timeStamp,
      version,
      applicationId,
      password,
      subscriberId,
      frequency,
      status,
    } = req.body;

    // Validate required fields
    if (!subscriberId || !status) {
      return res.status(400).json({
        statusCode: 'E1001',
        statusDetail: 'Missing required fields: subscriberId or status',
      });
    }

    // Extract phone number from subscriberId (format: tel:+8801XXXXXXXXX)
    let phoneNumber = subscriberId;
    if (phoneNumber.startsWith('tel:')) {
      phoneNumber = phoneNumber.replace('tel:', '');
    }

    // Find user by phone number
    const { data: user, error: userError } = await supabase
      .from(USERS_TABLE)
      .select('id, phone')
      .eq('phone', phoneNumber)
      .maybeSingle();

    if (userError) {
      console.error('Error finding user for subscription notification:', userError);
      // Still return success to AppLink to avoid retries
      return res.json({
        statusCode: 'S1000',
        statusDetail: 'Notification received',
      });
    }

    if (!user) {
      console.warn(`Subscription notification received for unknown phone: ${phoneNumber}`);
      // Still return success to AppLink
      return res.json({
        statusCode: 'S1000',
        statusDetail: 'Notification received (user not found)',
      });
    }

    // Update user subscription status
    const isSubscribed = status === 'REGISTERED';
    const updateData = {
      applink_subscribed: isSubscribed,
      applink_subscription_status: status,
    };

    if (isSubscribed) {
      updateData.applink_subscribed_at = new Date().toISOString();
      updateData.applink_unsubscribed_at = null;
    } else {
      updateData.applink_unsubscribed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from(USERS_TABLE)
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating subscription status:', updateError);
      // Still return success to AppLink
      return res.json({
        statusCode: 'S1000',
        statusDetail: 'Notification received (update failed)',
      });
    }

    console.log(`Subscription notification processed: ${phoneNumber} -> ${status}`);

    // Return success response to AppLink
    return res.json({
      statusCode: 'S1000',
      statusDetail: 'Request was successfully processed',
    });
  } catch (error) {
    console.error('handleSubscriptionNotification error', error);
    // Always return success to AppLink to prevent retries
    return res.json({
      statusCode: 'S1000',
      statusDetail: 'Notification received',
    });
  }
};
