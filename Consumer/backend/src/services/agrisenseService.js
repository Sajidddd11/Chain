const AGRISENSE_BASE_URL = 'https://agrisense-z6ks.onrender.com';

const buildUrl = (path) => {
  if (!path.startsWith('/')) {
    return `${AGRISENSE_BASE_URL}/${path}`;
  }
  return `${AGRISENSE_BASE_URL}${path}`;
};

const parseResponseBody = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const requestAgrisense = async (path, payload) => {
  if (typeof fetch === 'undefined') {
    throw new Error('Global fetch is not available in this runtime');
  }

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponseBody(response);

  if (!response.ok || (data && data.success === false)) {
    const message = data?.message || `Agrisense request failed (${response.status})`;
    const error = new Error(message);
    error.details = data || null;
    error.status = response.status;
    throw error;
  }

  return data || {};
};

export const enableWasteCollection = async (phoneNumber) => {
  if (!phoneNumber) {
    throw new Error('Phone number is required to enable Agrisense waste collection');
  }
  return requestAgrisense('/api/waste/enable', { phone_number: phoneNumber });
};

export const replaceWasteList = async (phoneNumber, wastes) => {
  if (!phoneNumber) {
    throw new Error('Phone number is required to sync Agrisense waste data');
  }
  return requestAgrisense('/api/waste/update', {
    phone_number: phoneNumber,
    wastes: wastes || [],
  });
};

export const fetchFarmerPackage = async (phoneNumber) => {
  if (!phoneNumber) {
    throw new Error('Phone number is required to fetch Agrisense farmer data');
  }
  return requestAgrisense('/api/voice/get-farmer-data', { phone_number: phoneNumber });
};


