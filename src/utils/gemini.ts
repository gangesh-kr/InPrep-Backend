import { GoogleGenAI } from '@google/genai';
import logger from './logger';

let aiClient: any = null;
const getAIClient = () => {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
};

export const isGeminiEnabled = () => !!process.env.GEMINI_API_KEY;

export async function callGemini(prompt: string, jsonMode: boolean = false): Promise<string> {
  const client = getAIClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not defined in the environment.');
  }

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: jsonMode ? {
          responseMimeType: 'application/json'
        } : undefined,
      });

      const text = response.text;
      if (text) return text;
    } catch (err: any) {
      logger.warn({ modelName, error: err.message || err }, `Model ${modelName} failed, trying fallback model...`);
      lastError = err;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message || lastError}`);
}
