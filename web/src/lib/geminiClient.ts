// server-only, never import from client components
import { GoogleGenerativeAI } from "@google/generative-ai";

let gemini: GoogleGenerativeAI | null = null;

export function getGemini(): GoogleGenerativeAI {
  if (gemini) return gemini;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: GEMINI_API_KEY");
  }

  gemini = new GoogleGenerativeAI(apiKey);
  return gemini;
}
