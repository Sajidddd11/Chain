import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function testOpenAI() {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'Say hello in one word' }],
      max_tokens: 5
    });
    console.log('✅ OpenAI API key is valid');
    console.log('Response:', response.choices[0].message.content.trim());
  } catch (error) {
    console.log('❌ OpenAI API key is invalid or error occurred');
    console.log('Error:', error.message);
  }
}

testOpenAI();