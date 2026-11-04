import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing. Check the server .env file.");
}

const ai = new GoogleGenAI({ apiKey });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateSummary(transcript) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Gemini summary attempt ${attempt}/${maxAttempts}`);

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `
You are an AI meeting assistant for IntellMeet.

Analyze this meeting transcript and return these sections:

1. Meeting Summary
2. Key Discussion Points
3. Decisions Made
4. Action Items

Include responsible people and deadlines only when explicitly mentioned.
Do not invent facts. Write "Not specified" for missing information.

Meeting transcript:
${transcript}
`,
      });

      const summary = response.text;

      if (!summary?.trim()) {
        throw new Error("The AI model returned an empty summary.");
      }

      return summary;
    } catch (error) {
      const status = Number(error.status ?? error.code);

      console.error(`Gemini attempt ${attempt} failed:`, error.message);

      const retryable = [429, 500, 502, 503, 504].includes(status);

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      const delay = attempt * 2000;
      console.log(`Retrying Gemini in ${delay / 1000} seconds...`);
      await sleep(delay);
    }
  }

  throw new Error("Unable to generate the meeting summary.");
}