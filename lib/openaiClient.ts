// lib/openaiClient.ts

import OpenAI from 'openai'; // Import OpenAI directly

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;
