import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function testAlternatives() {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are a nutrition and budget expert. For a given food item, suggest 3-4 cheaper alternative foods that provide similar nutritional value (calories, protein, healthy fats, etc.) but cost less. Focus on practical, commonly available alternatives.

Return a JSON array of objects with this exact structure:
[
  {
    "name": "Alternative Food Name",
    "calories": 150,
    "price": 2.50,
    "savings": 1.25,
    "reason": "Brief explanation of why this is a good alternative"
  }
]

Consider:
- Similar calorie density
- Comparable nutritional profile
- Realistic current market prices
- Practical substitutions (e.g., beef → lentils, chicken → eggs)
- Focus on cost savings while maintaining nutritional value

Return ONLY raw JSON. No markdown formatting, no code blocks.`,
        },
        {
          role: 'user',
          content: `Find cost-saving alternatives for: "beef steak". Suggest 3-4 cheaper options with similar nutritional value.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content?.trim();
    console.log('✅ OpenAI alternatives API working');
    console.log('Raw response:', content);

    // Try to parse the JSON
    const jsonString = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    const alternatives = JSON.parse(jsonString);

    console.log('✅ Parsed alternatives:');
    console.log(JSON.stringify(alternatives, null, 2));

  } catch (error) {
    console.log('❌ Error testing alternatives API');
    console.log('Error:', error.message);
  }
}

testAlternatives();