#!/usr/bin/env node

/**
 * Database Setup Script for Donation Features
 *
 * This script provides instructions for setting up the database tables.
 * The actual SQL must be run manually in Supabase SQL Editor.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { supabase } from './src/config/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function checkDatabaseConnection() {
  console.log('� Checking database connection...\n');

  if (!supabase) {
    console.error('❌ Supabase client is not configured. Please check your .env file.');
    console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    return false;
  }

  try {
    // Test connection by trying to query a known table (users table should exist)
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('❌ Database connection failed:', error.message);
      return false;
    }

    console.log('✅ Database connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function checkTablesExist() {
  console.log('\n🔍 Checking if donation tables exist...\n');

  const tables = ['donations', 'donation_requests', 'conversations', 'messages'];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Table '${table}' does not exist or is not accessible:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`);
      }
    } catch (error) {
      console.log(`❌ Table '${table}' check failed:`, error.message);
    }
  }
}

function printSetupInstructions() {
  console.log('\n📋 Setup Instructions:');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Navigate to the SQL Editor');
  console.log('3. Copy and paste the contents of: backend/migrations/001_create_donation_tables.sql');
  console.log('4. Click "Run" to execute the SQL');
  console.log('\n� Migration file location:');
  console.log('   backend/migrations/001_create_donation_tables.sql');
}

async function main() {
  console.log('🚀 Database Setup for Donation Features\n');

  const connected = await checkDatabaseConnection();
  if (!connected) {
    printSetupInstructions();
    return;
  }

  await checkTablesExist();
  printSetupInstructions();

  console.log('\n💡 After running the SQL migration, run this script again to verify the setup.');
}

main().catch(console.error);