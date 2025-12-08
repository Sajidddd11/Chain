import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Device } from '../types';
import { initializePushNotifications, unsubscribeFromPushNotifications, isPushNotificationSupported } from '../utils/pushNotifications';

export function Profile() {
  const { user, token, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    householdSize: '',
    childrenCount: '',
    teenCount: '',
    adultCount: '',
    elderlyCount: '',
    dietaryPreferences: '',
    budgetAmount: '',
    budgetPeriod: 'monthly',
    location: '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceForm, setDeviceForm] = useState({ apiKey: '', deviceName: '' });
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [pushNotificationsLoading, setPushNotificationsLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    subscribed: boolean;
    subscriptionStatus?: string | null;
    subscribedAt?: string | null;
    unsubscribedAt?: string | null;
    hasPhone: boolean;
    applinkConfigured?: boolean;
  } | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.full_name ?? '',
      phone: user.phone ?? '',
      householdSize: user.household_size?.toString() ?? '',
      childrenCount: user.household_children?.toString() ?? '',
      teenCount: user.household_teens?.toString() ?? '',
      adultCount: user.household_adults?.toString() ?? '',
      elderlyCount: user.household_elderly?.toString() ?? '',
      dietaryPreferences: user.dietary_preferences ?? '',
      budgetAmount: user.budget_amount_bdt?.toString() ?? '',
      budgetPeriod: user.budget_period ?? 'monthly',
      location: user.location ?? '',
    });
  }, [user]);

  useEffect(() => {
    const loadDevices = async () => {
      if (!token) return;
      try {
        const response = await api.listDevices(token);
        setDevices(response.devices);
      } catch (err) {
        console.error('Failed to load devices', err);
      }
    };
    loadDevices();

    // Auto-refresh device status every 30 seconds
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const checkPushNotificationStatus = async () => {
      if (!isPushNotificationSupported()) {
        setPushNotificationsEnabled(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushNotificationsEnabled(!!subscription);
      } catch (error) {
        console.error('Failed to check push notification status:', error);
        setPushNotificationsEnabled(false);
      }
    };

    checkPushNotificationStatus();
  }, []);

  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      if (!token) return;
      try {
        const status = await api.getSubscriptionStatus(token);
        setSubscriptionStatus(status);
      } catch (err) {
        console.error('Failed to load subscription status', err);
      }
    };
    loadSubscriptionStatus();
  }, [token]);

  const handleRegisterDevice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setDeviceLoading(true);
    setDeviceError(null);

    try {
      await api.registerDevice(token, deviceForm.apiKey, deviceForm.deviceName);
      setDeviceForm({ apiKey: '', deviceName: '' });
      const response = await api.listDevices(token);
      setDevices(response.devices);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Failed to register device');
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to remove this device?')) return;

    try {
      await api.removeDevice(token, deviceId);
      const response = await api.listDevices(token);
      setDevices(response.devices);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Failed to remove device');
    }
  };

  const isDeviceOnline = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return false;
    const lastSeen = new Date(lastSeenAt).getTime();
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
    return now - lastSeen < twoMinutes;
  };

  const handleTogglePushNotifications = async () => {
    if (!token) return;
    setPushNotificationsLoading(true);

    try {
      if (pushNotificationsEnabled) {
        // Disable push notifications
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          setPushNotificationsEnabled(false);
        }
      } else {
        // Enable push notifications
        const success = await initializePushNotifications(token);
        if (success) {
          setPushNotificationsEnabled(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle push notifications:', error);
    } finally {
      setPushNotificationsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setStatus('saving');
    setError(null);

    try {
      await api.updateProfile(token, {
        fullName: form.fullName,
        phone: form.phone,
        householdSize: form.householdSize ? Number(form.householdSize) : null,
        dietaryPreferences: form.dietaryPreferences,
        budgetAmountBdt: form.budgetAmount ? Number(form.budgetAmount) : null,
        budgetPeriod: form.budgetPeriod as 'daily' | 'weekly' | 'monthly' | 'yearly',
        location: form.location,
        childrenCount: form.childrenCount ? Number(form.childrenCount) : null,
        teenCount: form.teenCount ? Number(form.teenCount) : null,
        adultCount: form.adultCount ? Number(form.adultCount) : null,
        elderlyCount: form.elderlyCount ? Number(form.elderlyCount) : null,
      });
      await refreshProfile();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>User profile</h2>
        {status === 'saved' && <span style={{ color: '#1f7a4d' }}>Saved!</span>}
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <input
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
          />
          <input value={user?.email ?? ''} disabled />
          <input
            required
            placeholder="Phone (+8801XXXXXXXXX)"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <input
            type="number"
            min={1}
            placeholder="Household size"
            value={form.householdSize}
            onChange={(e) => setForm((prev) => ({ ...prev, householdSize: e.target.value }))}
          />
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#475569' }}>
              Household breakdown
            </label>
            <div
              style={{
                display: 'grid',
                gap: '0.75rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              }}
            >
              <input
                type="number"
                min="0"
                placeholder="Children"
                value={form.childrenCount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, childrenCount: e.target.value }))
                }
              />
              <input
                type="number"
                min="0"
                placeholder="Teens"
                value={form.teenCount}
                onChange={(e) => setForm((prev) => ({ ...prev, teenCount: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                placeholder="Adults"
                value={form.adultCount}
                onChange={(e) => setForm((prev) => ({ ...prev, adultCount: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                placeholder="Elderly"
                value={form.elderlyCount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, elderlyCount: e.target.value }))
                }
              />
            </div>
          </div>
          <input
            placeholder="Dietary preferences"
            value={form.dietaryPreferences}
            onChange={(e) => setForm((prev) => ({ ...prev, dietaryPreferences: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#475569' }}>
                Budget amount (BDT)
              </label>
              <div className="currency-field">
                <span>BDT</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.budgetAmount}
                  onChange={(e) => setForm((prev) => ({ ...prev, budgetAmount: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#475569' }}>
                Budget cadence
              </label>
              <select
                value={form.budgetPeriod}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    budgetPeriod: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly',
                  }))
                }
              >
                <option value="daily">Per day</option>
                <option value="weekly">Per week</option>
                <option value="monthly">Per month</option>
                <option value="yearly">Per year</option>
              </select>
            </div>
          </div>
          <input
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          />

          {error && <p className="error-text">{error}</p>}

          <button className="primary-btn" type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3>Connected Devices</h3>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
          Pair your ESP32 device by entering the API key shown on its display.
        </p>

        <form onSubmit={handleRegisterDevice} style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
          <input
            required
            placeholder="Device API Key (from device display)"
            value={deviceForm.apiKey}
            onChange={(e) => setDeviceForm((prev) => ({ ...prev, apiKey: e.target.value }))}
          />
          <input
            required
            placeholder="Device Name (e.g., Kitchen Counter)"
            value={deviceForm.deviceName}
            onChange={(e) => setDeviceForm((prev) => ({ ...prev, deviceName: e.target.value }))}
          />
          {deviceError && <p className="error-text">{deviceError}</p>}
          <button className="primary-btn" type="submit" disabled={deviceLoading}>
            {deviceLoading ? 'Registering…' : 'Pair Device'}
          </button>
        </form>

        {devices.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {devices.map((device) => (
              <div
                key={device.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>{device.device_name || 'Unnamed Device'}</strong>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isDeviceOnline(device.last_seen_at) ? '#10b981' : '#ef4444',
                        boxShadow: isDeviceOnline(device.last_seen_at)
                          ? '0 0 4px #10b981'
                          : 'none',
                      }}
                      title={isDeviceOnline(device.last_seen_at) ? 'Online' : 'Offline'}
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: isDeviceOnline(device.last_seen_at) ? '#10b981' : '#ef4444',
                        fontWeight: 600,
                      }}
                    >
                      {isDeviceOnline(device.last_seen_at) ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    API Key: {device.api_key.substring(0, 8)}...
                    {device.last_seen_at
                      ? ` · Last seen: ${new Date(device.last_seen_at).toLocaleString()}`
                      : ' · Never connected'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDevice(device.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b' }}>No devices paired yet.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3>Push Notifications</h3>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
          Receive real-time notifications about your food inventory, orders, and important updates.
        </p>

        {!isPushNotificationSupported() ? (
          <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>
            Push notifications are not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pushNotificationsEnabled}
                onChange={handleTogglePushNotifications}
                disabled={pushNotificationsLoading}
                style={{ width: '1rem', height: '1rem' }}
              />
              <span>Enable push notifications</span>
            </label>
            {pushNotificationsLoading && (
              <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Updating...</span>
            )}
          </div>
        )}

        {pushNotificationsEnabled && (
          <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.5rem' }}>
            ✓ Push notifications are enabled. You'll receive notifications for important updates.
          </p>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3>Banglalink AppLink Subscription</h3>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
          Subscribe to receive SMS notifications, access premium features, and enable mobile billing for your orders.
        </p>

        {subscriptionStatus === null ? (
          <p style={{ color: '#64748b' }}>Loading subscription status...</p>
        ) : !subscriptionStatus.hasPhone ? (
          <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #fbbf24' }}>
            <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
              ⚠️ Please add a phone number to your profile to enable AppLink subscription.
            </p>
          </div>
        ) : !subscriptionStatus.applinkConfigured ? (
          <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #fbbf24' }}>
            <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              ⚠️ AppLink credentials not configured. Subscription will work locally but won't connect to AppLink API.
            </p>
            <p style={{ margin: 0, color: '#78350f', fontSize: '0.85rem' }}>
              To enable full AppLink integration, add APPLINK_APPLICATION_ID and APPLINK_PASSWORD to backend/.env
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: subscriptionStatus.subscribed ? '#f0fdf4' : '#fef2f2',
                borderRadius: '0.5rem',
                border: `1px solid ${subscriptionStatus.subscribed ? '#10b981' : '#ef4444'}`,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <strong style={{ color: subscriptionStatus.subscribed ? '#059669' : '#dc2626' }}>
                    {subscriptionStatus.subscribed ? '✓ Subscribed' : '✗ Not Subscribed'}
                  </strong>
                  {subscriptionStatus.subscriptionStatus && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        background: subscriptionStatus.subscribed ? '#d1fae5' : '#fee2e2',
                        color: subscriptionStatus.subscribed ? '#065f46' : '#991b1b',
                        borderRadius: '0.25rem',
                        fontWeight: 600,
                      }}
                    >
                      {subscriptionStatus.subscriptionStatus}
                    </span>
                  )}
                </div>
                {subscriptionStatus.subscribed && subscriptionStatus.subscribedAt && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Subscribed on: {new Date(subscriptionStatus.subscribedAt).toLocaleDateString()}
                  </p>
                )}
                {!subscriptionStatus.subscribed && subscriptionStatus.unsubscribedAt && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Unsubscribed on: {new Date(subscriptionStatus.unsubscribedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!token) return;
                setSubscriptionLoading(true);
                try {
                  if (subscriptionStatus.subscribed) {
                    await api.unsubscribe(token);
                    const newStatus = await api.getSubscriptionStatus(token);
                    setSubscriptionStatus(newStatus);
                    setStatus('saved');
                    setTimeout(() => setStatus('idle'), 2000);
                  } else {
                    await api.subscribe(token);
                    const newStatus = await api.getSubscriptionStatus(token);
                    setSubscriptionStatus(newStatus);
                    setStatus('saved');
                    setTimeout(() => setStatus('idle'), 2000);
                  }
                  await refreshProfile();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to update subscription');
                } finally {
                  setSubscriptionLoading(false);
                }
              }}
              disabled={subscriptionLoading}
              className="primary-btn"
              style={{
                background: subscriptionStatus.subscribed ? '#ef4444' : '#1f7a4d',
                width: '100%',
              }}
            >
              {subscriptionLoading
                ? 'Processing...'
                : subscriptionStatus.subscribed
                  ? 'Unsubscribe from AppLink'
                  : 'Subscribe to AppLink'}
            </button>

            {subscriptionStatus.subscribed && (
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                You're subscribed to AppLink services. You'll receive SMS notifications and can use mobile billing for payments.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

