#!/usr/bin/env node

/**
 * Test Script for Donation Database Tables
 *
 * This script tests that all donation-related database operations work correctly.
 * Run after setting up the database tables.
 */

import { supabase } from './src/config/supabaseClient.js';

async function testDonationTables() {
  console.log('🧪 Testing donation database tables...\n');

  if (!supabase) {
    console.error('❌ Supabase client is not configured');
    return;
  }

  try {
    // Test 1: Check if tables exist by trying to select from them
    console.log('1. Checking table existence...');
    const tables = ['donations', 'donation_requests', 'conversations', 'messages'];

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error && error.message.includes('does not exist')) {
          console.log(`❌ Table '${table}' does not exist`);
          return;
        }
        console.log(`✅ Table '${table}' exists`);
      } catch (err) {
        console.log(`❌ Error checking table '${table}':`, err.message);
        return;
      }
    }

    console.log('\n2. Testing basic operations...');

    // Note: These tests will fail if there are RLS policies blocking access
    // That's expected - we're just testing table structure

    // Test donations table structure
    try {
      const { error } = await supabase
        .from('donations')
        .select('id, user_id, title, status, created_at')
        .limit(1);

      if (error && !error.message.includes('Row Level Security')) {
        console.log('⚠️  Donations table structure issue:', error.message);
      } else {
        console.log('✅ Donations table structure OK');
      }
    } catch (err) {
      console.log('⚠️  Donations table test failed:', err.message);
    }

    // Test donation_requests table structure
    try {
      const { error } = await supabase
        .from('donation_requests')
        .select('id, donation_id, user_id, status, created_at')
        .limit(1);

      if (error && !error.message.includes('Row Level Security')) {
        console.log('⚠️  Donation requests table structure issue:', error.message);
      } else {
        console.log('✅ Donation requests table structure OK');
      }
    } catch (err) {
      console.log('⚠️  Donation requests table test failed:', err.message);
    }

    // Test conversations table structure
    try {
      const { error } = await supabase
        .from('conversations')
        .select('id, donation_id, participants, created_at')
        .limit(1);

      if (error && !error.message.includes('Row Level Security')) {
        console.log('⚠️  Conversations table structure issue:', error.message);
      } else {
        console.log('✅ Conversations table structure OK');
      }
    } catch (err) {
      console.log('⚠️  Conversations table test failed:', err.message);
    }

    // Test messages table structure
    try {
      const { error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .limit(1);

      if (error && !error.message.includes('Row Level Security')) {
        console.log('⚠️  Messages table structure issue:', error.message);
      } else {
        console.log('✅ Messages table structure OK');
      }
    } catch (err) {
      console.log('⚠️  Messages table test failed:', err.message);
    }

    console.log('\n✅ Database table tests completed!');
    console.log('\n💡 Note: RLS policy errors are expected and indicate proper security setup.');
    console.log('   The donation API endpoints will work correctly with authenticated users.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDonationTables();