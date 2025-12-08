// Push notification utilities
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

// Check if push notifications are supported
export const isPushNotificationSupported = (): boolean => {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }

  const permission = await Notification.requestPermission();
  return permission;
};

// Register service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('Service Worker registered successfully:', registration);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    throw error;
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async (
  vapidPublicKey: string
): Promise<PushSubscriptionData | null> => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any
    });

    console.log('Push subscription created:', subscription);

    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
      }
    };

    return subscriptionData;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async (): Promise<boolean> => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const result = await subscription.unsubscribe();
      console.log('Successfully unsubscribed from push notifications');
      return result;
    }

    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
};

// Get current push subscription
export const getCurrentPushSubscription = async (): Promise<PushSubscription | null> => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (error) {
    console.error('Failed to get current push subscription:', error);
    return null;
  }
};

// Send subscription to backend
export const sendSubscriptionToBackend = async (
  subscription: PushSubscriptionData,
  token: string
): Promise<boolean> => {
  try {
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription })
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription to backend');
    }

    console.log('Subscription sent to backend successfully');
    return true;
  } catch (error) {
    console.error('Failed to send subscription to backend:', error);
    return false;
  }
};

// Get VAPID public key from backend
export const getVapidPublicKey = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/notifications/vapid-public-key');
    if (!response.ok) {
      throw new Error('Failed to get VAPID public key');
    }
    const data = await response.json();
    return data.publicKey;
  } catch (error) {
    console.error('Failed to get VAPID public key:', error);
    return null;
  }
};

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Initialize push notifications
export const initializePushNotifications = async (token: string): Promise<boolean> => {
  try {
    // Check if supported
    if (!isPushNotificationSupported()) {
      console.log('Push notifications are not supported in this browser');
      return false;
    }

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Register service worker
    await registerServiceWorker();

    // Check if already subscribed
    const existingSubscription = await getCurrentPushSubscription();
    if (existingSubscription) {
      console.log('Already subscribed to push notifications');
      return true;
    }

    // Subscribe to push notifications
    // Get the VAPID public key from backend
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      console.error('VAPID public key not available from backend');
      return false;
    }

    const subscription = await subscribeToPushNotifications(vapidPublicKey);
    if (!subscription) {
      return false;
    }

    // Send subscription to backend
    const success = await sendSubscriptionToBackend(subscription, token);
    return success;

  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
    return false;
  }
};

// Test notification (for development)
export const showTestNotification = async (): Promise<void> => {
  if (Notification.permission === 'granted') {
    const notification = new Notification('BUBT Food', {
      body: 'This is a test notification!',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};