import "./env.js";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is missing from server/.env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function checkModels() {
  try {
    console.log("Checking models available to your API key...\n");

    const result = await ai.models.list();

    const models = result.page ?? result.models ?? [];

    if (!Array.isArray(models) || models.length === 0) {
      console.log("No models found on the first page.");
      console.log("Response structure:", Object.keys(result));
      return;
    }

    for (const model of models) {
      if (model.supportedActions?.includes("generateContent")) {
        console.log(`${model.name} — ${model.displayName}`);
      }
    }

    console.log("\nModel check completed.");
  } catch (error) {
    console.error("Unable to list models:", error.message);
  }
}

checkModels();