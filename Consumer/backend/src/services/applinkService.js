/**
 * Banglalink AppLink API Service
 * Handles integration with AppLink subscription APIs
 */

const APPLINK_BASE_URL = process.env.APPLINK_BASE_URL || 'https://dev.applink.com.bd';
const APPLINK_APPLICATION_ID = process.env.APPLINK_APPLICATION_ID;
const APPLINK_PASSWORD = process.env.APPLINK_PASSWORD;

/**
 * Check if AppLink credentials are configured
 */
export const isAppLinkConfigured = () => {
  return !!(APPLINK_APPLICATION_ID && APPLINK_PASSWORD);
};

/**
 * Make a request to AppLink API
 */
const makeAppLinkRequest = async (endpoint, payload) => {
  if (!APPLINK_APPLICATION_ID || !APPLINK_PASSWORD) {
    // In development mode, return a mock response instead of throwing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  AppLink credentials not configured. Running in mock mode.');
      return {
        statusCode: 'S1000',
        statusDetail: 'Mock response - AppLink credentials not configured',
        subscriptionStatus: 'REGISTERED',
        version: '1.0',
      };
    }
    throw new Error('AppLink credentials not configured. Please set APPLINK_APPLICATION_ID and APPLINK_PASSWORD in environment variables.');
  }

  const url = `${APPLINK_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      applicationId: APPLINK_APPLICATION_ID,
      password: APPLINK_PASSWORD,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AppLink API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Subscribe a user to AppLink services
 * @param {string} subscriberId - Phone number in format tel:+8801XXXXXXXXX
 * @returns {Promise<Object>} AppLink API response
 */
export const subscribeUser = async (subscriberId) => {
  // Ensure phone number is in correct format
  let formattedPhone = subscriberId;
  if (!formattedPhone.startsWith('tel:')) {
    if (formattedPhone.startsWith('+880')) {
      formattedPhone = `tel:${formattedPhone}`;
    } else if (formattedPhone.startsWith('880')) {
      formattedPhone = `tel:+${formattedPhone}`;
    } else if (formattedPhone.startsWith('01')) {
      formattedPhone = `tel:+880${formattedPhone}`;
    } else {
      formattedPhone = `tel:${formattedPhone}`;
    }
  }

  const payload = {
    version: '1.0',
    subscriberId: formattedPhone,
    action: '1', // 1 = subscribe, 0 = unsubscribe
  };

  try {
    const response = await makeAppLinkRequest('/subscription/send', payload);
    return {
      success: response.statusCode === 'S1000',
      statusCode: response.statusCode,
      statusDetail: response.statusDetail,
      subscriptionStatus: response.subscriptionStatus,
      version: response.version,
    };
  } catch (error) {
    console.error('AppLink subscribe error:', error);
    throw error;
  }
};

/**
 * Unsubscribe a user from AppLink services
 * @param {string} subscriberId - Phone number in format tel:+8801XXXXXXXXX
 * @returns {Promise<Object>} AppLink API response
 */
export const unsubscribeUser = async (subscriberId) => {
  // Ensure phone number is in correct format
  let formattedPhone = subscriberId;
  if (!formattedPhone.startsWith('tel:')) {
    if (formattedPhone.startsWith('+880')) {
      formattedPhone = `tel:${formattedPhone}`;
    } else if (formattedPhone.startsWith('880')) {
      formattedPhone = `tel:+${formattedPhone}`;
    } else if (formattedPhone.startsWith('01')) {
      formattedPhone = `tel:+880${formattedPhone}`;
    } else {
      formattedPhone = `tel:${formattedPhone}`;
    }
  }

  const payload = {
    version: '1.0',
    subscriberId: formattedPhone,
    action: '0', // 0 = unsubscribe, 1 = subscribe
  };

  try {
    const response = await makeAppLinkRequest('/subscription/send', payload);
    return {
      success: response.statusCode === 'S1000',
      statusCode: response.statusCode,
      statusDetail: response.statusDetail,
      subscriptionStatus: response.subscriptionStatus,
      version: response.version,
    };
  } catch (error) {
    console.error('AppLink unsubscribe error:', error);
    throw error;
  }
};

/**
 * Get subscription base size (total number of subscribers)
 * @returns {Promise<Object>} AppLink API response with baseSize
 */
export const getSubscriptionBaseSize = async () => {
  const payload = {
    version: '1.0',
  };

  try {
    const response = await makeAppLinkRequest('/subscription/query-base', payload);
    return {
      success: response.statusCode === 'S1000',
      statusCode: response.statusCode,
      statusDetail: response.statusDetail,
      baseSize: response.baseSize,
      version: response.version,
    };
  } catch (error) {
    console.error('AppLink get base size error:', error);
    throw error;
  }
};
