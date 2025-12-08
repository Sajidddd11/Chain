import { supabase } from './src/config/supabaseClient.js';

async function updateProductPrices() {
  console.log('Updating product prices to BDT...');

  // Update existing products with BDT prices
  const priceUpdates = [
    { name: 'Fresh Tomatoes', price: 120.00 },
    { name: 'Basmati Rice', price: 85.00 },
    { name: 'Fresh Milk', price: 90.00 },
    { name: 'Chicken Breast', price: 380.00 },
    { name: 'Bananas', price: 65.00 },
    { name: 'Whole Wheat Bread', price: 45.00 },
    { name: 'Eggs', price: 130.00 },
    { name: 'Cooking Oil', price: 220.00 },
    { name: 'Potatoes', price: 35.00 },
    { name: 'Onions', price: 45.00 },
    { name: 'Apples', price: 220.00 },
    { name: 'Orange Juice', price: 160.00 },
  ];

  for (const update of priceUpdates) {
    const { error } = await supabase
      .from('products')
      .update({ price: update.price })
      .eq('name', update.name);

    if (error) {
      console.error(`❌ Failed to update ${update.name}:`, error);
    } else {
      console.log(`✅ Updated ${update.name} to BDT ${update.price}`);
    }
  }

  console.log('✅ Product prices updated to BDT');
}

updateProductPrices();