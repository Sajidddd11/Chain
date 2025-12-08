import { supabase } from './src/config/supabaseClient.js';

async function createTables() {
  try {
    console.log('Creating grocery store tables...');

    // Check if products table exists
    const { data: existingProducts, error: checkError } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Products table already exists');
      return;
    }

    console.log('❌ Products table does not exist. Please run the SQL migration manually in Supabase SQL Editor.');
    console.log('Migration file: backend/migrations/003_create_grocery_store.sql');

  } catch (error) {
    console.error('Error checking tables:', error);
    console.log('Please run the SQL migration manually in Supabase SQL Editor.');
    console.log('Migration file: backend/migrations/003_create_grocery_store.sql');
  }
}

createTables();