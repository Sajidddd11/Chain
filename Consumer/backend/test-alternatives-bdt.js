import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mock the API call to test alternatives generation
async function testAlternativesLogic() {
  console.log('Testing AI-powered alternatives logic...\n');

  // Import the controller function
  const { getAlternatives } = await import('./src/controllers/inventoryController.js');

  // Mock request/response objects
  const mockReq = {
    params: { itemName: 'chicken breast' },
    query: { price: '500' }
  };

  const mockRes = {
    json: (data) => {
      console.log('✅ AI Alternatives Response:');
      console.log(JSON.stringify(data, null, 2));
      return data;
    },
    status: (code) => ({
      json: (data) => {
        console.log(`❌ Error Response (${code}):`, data);
        return data;
      }
    })
  };

  // Mock the OpenAI and Supabase dependencies
  global.openai = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{
            message: {
              content: JSON.stringify([
                {
                  name: "Chicken Thigh",
                  price: 420.00,
                  unit: "kg",
                  category: "Protein",
                  calories: 180,
                  savings: 80.00,
                  reason: "Similar protein content, more affordable in Bangladesh market"
                },
                {
                  name: "Eggs (6-pack)",
                  price: 300.00,
                  unit: "pcs",
                  category: "Protein",
                  calories: 420,
                  savings: 200.00,
                  reason: "High protein, very cost-effective alternative"
                },
                {
                  name: "Lentils",
                  price: 180.00,
                  unit: "kg",
                  category: "Protein",
                  calories: 680,
                  savings: 320.00,
                  reason: "Plant-based protein, excellent value"
                }
              ])
            }
          }]
        })
      }
    }
  };

  try {
    await getAlternatives(mockReq, mockRes);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAlternativesLogic();