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
 * @param {string} subscriberId - Phone number in format tel:8801XXXXXXXXX
 * @returns {Promise<Object>} AppLink API response
 */
export const subscribeUser = async (subscriberId) => {
  // Ensure phone number is in correct format
  let formattedPhone = subscriberId;
  // Remove any existing tel: prefix or + sign to clean up
  formattedPhone = formattedPhone.replace(/^tel:/, '').replace(/^\+/, '');

  // Ensure it starts with 880
  if (formattedPhone.startsWith('01')) {
    formattedPhone = `880${formattedPhone}`;
  }

  // Add tel: prefix
  formattedPhone = `tel:${formattedPhone}`;

  const payload = {
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
 * @param {string} subscriberId - Phone number in format tel:8801XXXXXXXXX
 * @returns {Promise<Object>} AppLink API response
 */
export const unsubscribeUser = async (subscriberId) => {
  // Ensure phone number is in correct format
  let formattedPhone = subscriberId;
  // Remove any existing tel: prefix or + sign to clean up
  formattedPhone = formattedPhone.replace(/^tel:/, '').replace(/^\+/, '');

  // Ensure it starts with 880
  if (formattedPhone.startsWith('01')) {
    formattedPhone = `880${formattedPhone}`;
  }

  // Add tel: prefix
  formattedPhone = `tel:${formattedPhone}`;

  const payload = {
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
  const payload = {};

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

/**
 * Get subscriber charging info
 * @param {string[]} subscriberIds - Array of phone numbers
 * @returns {Promise<Object>} AppLink API response
 */
export const getSubscriberChargingInfo = async (subscriberIds) => {
  // Format all phone numbers
  const formattedIds = subscriberIds.map(id => {
    let formatted = id.replace(/^tel:/, '').replace(/^\+/, '');
    if (formatted.startsWith('01')) {
      formatted = `880${formatted}`;
    }
    return `tel: ${formatted}`; // Note: Doc shows space after tel: "tel: 880..."
  });

  const payload = {
    subscriberIds: formattedIds,
  };

  try {
    const response = await makeAppLinkRequest('/subscription/getSubscriberChargingInfo', payload);
    return {
      success: response.statusCode === 'S1000',
      statusCode: response.statusCode,
      statusDetail: response.statusDetail,
      destinationResponses: response.destinationResponses,
      version: response.version,
    };
  } catch (error) {
    console.error('AppLink get charging info error:', error);
    throw error;
  }
};

/**
 * Request charging OTP (CaaS direct debit)
 * @param {string} subscriberId - Phone number
 * @param {string} amount - Amount to charge (e.g., "49.00")
 * @param {string} externalTrxId - Unique transaction ID from your system
 * @returns {Promise<Object>} AppLink API response with reference number
 */
export const requestChargingOTP = async (subscriberId, amount, externalTrxId) => {
  // Format phone number: 01XXXXXXXXX → tel:8801XXXXXXXXX
  let formattedPhone = subscriberId.replace(/^tel:/, '').replace(/^\+/, '');

  // Remove leading 0 if present, then add country code
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1); // Remove leading 0
  }

  // Add country code if not present
  if (!formattedPhone.startsWith('880')) {
    formattedPhone = `880${formattedPhone}`;
  }

  formattedPhone = `tel:${formattedPhone}`;

  const payload = {
    externalTrxId,
    amount: parseFloat(amount).toFixed(2),
    paymentInstrumentName: 'Mobile Account',
    subscriberId: formattedPhone,
    Currency: 'BDT',
  };

  try {
    const response = await makeAppLinkRequest('/caas/direct/debit', payload);
    return {
      success: response.statusCode === 'S1000' || response.statusCode === 'P1003',
      statusCode: response.statusCode,
      statusDetail: response.statusDetail,
      requestCorrelator: response.requestCorrelator,
      internalTrxId: response.internalTrxId,
      externalTrxId: response.externalTrxId,
      timeStamp: response.timeStamp,
    };
  } catch (error) {
    console.error('AppLink request charging OTP error:', error);
    throw error;
  }
};

/**
 * Verify charging OTP and complete payment
 * @param {string} referenceNo - Request correlator from OTP generation
 * @param {string} otp - OTP entered by user
 * @param {string} sourceAddress - Phone number
 * @returns {Promise<Object>} AppLink API response
 */
export const verifyChargingOTP = async (referenceNo, otp, sourceAddress) => {
  // Format phone number: 01XXXXXXXXX → tel:8801XXXXXXXXX
  let formattedPhone = sourceAddress.replace(/^tel:/, '').replace(/^\+/, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
  }
  if (!formattedPhone.startsWith('880')) {
    formattedPhone = `880${formattedPhone}`;
  }
  formattedPhone = `tel:${formattedPhone}`;

  const payload = {
    referenceNo,
    otp,
    sourceAddress: formattedPhone,
  };

  try {
    const response = await makeAppLinkRequest('/caas/otp/verify', payload);
    return {
      success: response.statusCode === 'S1000',
      statusCode: response.statusCode,
      statusDetail: response.statusDetail,
      timeStamp: response.timeStamp,
      externalTrxId: response.externalTrxId,
      internalTrxId: response.internalTrxId,
    };
  } catch (error) {
    console.error('AppLink verify charging OTP error:', error);
    throw error;
  }
};

/**
 * Query subscriber balance
 * @param {string} subscriberId - Phone number
 * @returns {Promise<Object>} AppLink API response with balance info
 */
export const queryBalance = async (subscriberId) => {
  // Format phone number: 01XXXXXXXXX → tel:8801XXXXXXXXX
  let formattedPhone = subscriberId.replace(/^tel:/, '').replace(/^\+/, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
  }
  if (!formattedPhone.startsWith('880')) {
    formattedPhone = `880${formattedPhone}`;
  }
  formattedPhone = `tel:${formattedPhone}`;

  const payload = {
    subscriberId: formattedPhone,
  };

  try {
    const response = await makeAppLinkRequest('/caas/get/balance', payload);
    return {
      success: response.statusCode === 'S1000',
      statusCode: response.statusCode,
      statusDetail: response.statusDetail,
      accountStatus: response.accountStatus,
      accountType: response.accountType,
      accountBalance: response.accountBalance,
    };
  } catch (error) {
    console.error('AppLink query balance error:', error);
    throw error;
  }
};
