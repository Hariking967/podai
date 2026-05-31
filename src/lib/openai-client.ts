import OpenAI from "openai";

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25000, // Keep API calls responsive
  maxRetries: 0, // Avoid long retry chains under load
});
