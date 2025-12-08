#!/usr/bin/env node

/**
 * API Test Script for Donation Endpoints
 *
 * This script tests the donation API endpoints to ensure they work with the database.
 */

const API_BASE = 'http://localhost:5000/api';

async function testDonationsAPI() {
  console.log('🧪 Testing Donation API Endpoints...\n');

  try {
    // Test 1: Get donations (should work without auth for available donations)
    console.log('1. Testing GET /api/donations...');
    const response = await fetch(`${API_BASE}/donations`);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ GET /api/donations works!');
      console.log(`   Found ${data.donations?.length || 0} donations`);
    } else {
      console.log('❌ GET /api/donations failed:', data.message);
    }

    // Test 2: Check if other endpoints are accessible (they will fail due to no auth, but should not crash)
    console.log('\n2. Testing endpoint availability...');

    const endpoints = [
      { path: '/donations', method: 'POST', description: 'Create donation' },
      { path: '/messages/conversations', method: 'GET', description: 'Get conversations' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${API_BASE}${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        // We expect auth errors, not server crashes
        if (response.status === 401 || response.status === 403) {
          console.log(`✅ ${endpoint.description} endpoint accessible (auth required as expected)`);
        } else if (response.ok) {
          console.log(`✅ ${endpoint.description} endpoint works`);
        } else {
          console.log(`⚠️  ${endpoint.description} endpoint returned: ${response.status} - ${data.message}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint.description} endpoint error:`, error.message);
      }
    }

    console.log('\n✅ API tests completed!');
    console.log('\n💡 Note: Auth-required endpoints show 401/403 errors which is expected.');
    console.log('   The donation system is ready to use with proper authentication.');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n💡 Make sure the backend server is running on port 5000');
  }
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch('http://localhost:5000/health');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking if backend server is running...\n');

  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Backend server is not running on port 5000');
    console.log('   Please start it with: cd backend && npm run dev');
    return;
  }

  console.log('✅ Backend server is running');
  await testDonationsAPI();
}

main().catch(console.error);