import webpush from 'web-push';
import { supabase } from '../config/supabaseClient.js';

// Configure VAPID keys
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    'mailto:admin@bubt-food.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

/**
 * Send a push notification to a specific user
 * @param {number} userId - The user ID to send the notification to
 * @param {Object} notification - The notification payload
 * @param {string} notification.title - The notification title
 * @param {string} notification.body - The notification body
 * @param {Object} notification.data - Additional data to include
 * @param {string} notification.icon - Icon URL
 * @param {string} notification.badge - Badge URL
 */
export const sendPushNotification = async (userId, notification) => {
  try {
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      console.warn('VAPID keys not configured, skipping push notification');
      return false;
    }

    // Get user's push subscription
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !subscription) {
      console.log(`No push subscription found for user ${userId}`);
      return false;
    }

    // Prepare the push payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/icon-192x192.png',
      data: notification.data || {},
      timestamp: Date.now(),
    });

    // Send the push notification
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key,
      },
    };

    await webpush.sendNotification(pushSubscription, payload);
    console.log(`Push notification sent to user ${userId}`);
    return true;

  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
};

/**
 * Send a push notification to all users (broadcast)
 * @param {Object} notification - The notification payload
 */
export const broadcastPushNotification = async (notification) => {
  try {
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      console.warn('VAPID keys not configured, skipping broadcast push notification');
      return 0;
    }

    // Get all push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error || !subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for broadcast');
      return 0;
    }

    let successCount = 0;

    // Send to each subscription
    for (const subscription of subscriptions) {
      try {
        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icon-192x192.png',
          badge: notification.badge || '/icon-192x192.png',
          data: notification.data || {},
          timestamp: Date.now(),
        });

        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        successCount++;
      } catch (error) {
        console.error(`Failed to send push notification to user ${subscription.user_id}:`, error);
        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', subscription.id);
        }
      }
    }

    console.log(`Broadcast push notification sent to ${successCount}/${subscriptions.length} users`);
    return successCount;

  } catch (error) {
    console.error('Failed to broadcast push notification:', error);
    return 0;
  }
};

export default {
  sendPushNotification,
  broadcastPushNotification,
};