import { supabase } from './src/config/supabaseClient.js';

async function test() {
  if (!supabase) {
    console.log('Supabase not configured');
    return;
  }

  try {
    console.log('Testing database connection...');

    // Check conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(5);

    if (convError) {
      console.log('Conversations error:', convError);
    } else {
      console.log(`Found ${conversations.length} conversations`);
      if (conversations.length > 0) {
        console.log('Sample conversation:', conversations[0]);
      }
    }

    // Check messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .limit(5);

    if (msgError) {
      console.log('Messages error:', msgError);
    } else {
      console.log(`Found ${messages.length} messages`);
      if (messages.length > 0) {
        console.log('Sample message:', messages[0]);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();