import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api/subscription';

// Test AppLink endpoints
async function testAppLinkEndpoints() {
  console.log('Testing AppLink API endpoints...\n');

  try {
    // Test 1: Get Base Size
    console.log('1. Testing getBaseSize endpoint...');
    const baseSizeResponse = await fetch(`${BASE_URL}/baseSize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const baseSizeData = await baseSizeResponse.json();
    console.log('Base Size Response:', baseSizeData);

    // Test 2: Query Base
    console.log('\n2. Testing queryBase endpoint...');
    const queryBaseResponse = await fetch(`${BASE_URL}/query-base`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const queryBaseData = await queryBaseResponse.json();
    console.log('Query Base Response:', queryBaseData);

    // Test 3: User Subscription (subscribe)
    console.log('\n3. Testing userSubscription endpoint (subscribe)...');
    const subscribeResponse = await fetch(`${BASE_URL}/userSubscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriberId: 'tel:+8801712345678',
        action: 1
      })
    });
    const subscribeData = await subscribeResponse.json();
    console.log('Subscribe Response:', subscribeData);

    // Test 4: Send Subscription
    console.log('\n4. Testing sendSubscription endpoint...');
    const sendSubResponse = await fetch(`${BASE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriberId: 'tel:+8801712345678',
        action: 1
      })
    });
    const sendSubData = await sendSubResponse.json();
    console.log('Send Subscription Response:', sendSubData);

    // Test 5: Get Subscriber Charging Info
    console.log('\n5. Testing getSubscriberChargingInfo endpoint...');
    const chargingResponse = await fetch(`${BASE_URL}/getSubscriberChargingInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriberIds: ['tel:+8801712345678']
      })
    });
    const chargingData = await chargingResponse.json();
    console.log('Subscriber Charging Info Response:', chargingData);

    // Test 6: Send Notification
    console.log('\n6. Testing sendNotification endpoint...');
    const notifyResponse = await fetch(`${BASE_URL}/notify-subscriber`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeStamp: new Date().toISOString(),
        version: '1.0',
        subscriberId: 'tel:+8801712345678',
        frequency: 'monthly',
        status: 'REGISTERED'
      })
    });
    const notifyData = await notifyResponse.json();
    console.log('Send Notification Response:', notifyData);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the tests
testAppLinkEndpoints();