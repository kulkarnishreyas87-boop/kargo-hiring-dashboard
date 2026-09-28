import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local before running the pipeline.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * Calls Gemini Flash and forces strict JSON output. Retries once on parse failure
 * by re-asking the model to fix its own output (cheap self-repair, no crash on
 * a stray markdown fence or trailing comma).
 */
export async function generateJson<T>(params: {
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T> {
  const ai = getClient();
  const call = (extra?: string) =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: extra ? `${params.prompt}\n\n${extra}` : params.prompt,
      config: {
        systemInstruction: params.system,
        temperature: params.temperature ?? 0.1,
        responseMimeType: "application/json",
      },
    });

  let text = "";
  try {
    const res = await call();
    text = res.text ?? "";
    return JSON.parse(stripFence(text)) as T;
  } catch (err) {
    try {
      const res = await call(
        `Your previous reply could not be parsed as JSON. Reply again with ONLY valid, complete JSON matching the requested shape — no markdown fences, no commentary.`
      );
      text = res.text ?? "";
      return JSON.parse(stripFence(text)) as T;
    } catch (err2) {
      throw new Error(
        `Gemini did not return valid JSON after retry. Raw text: ${text.slice(0, 500)}. Error: ${
          (err2 as Error).message
        }`
      );
    }
  }
}

function stripFence(s: string): string {
  const trimmed = s.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}
