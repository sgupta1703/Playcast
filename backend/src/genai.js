// src/genai.js
// Wrapper for @google/genai with robust fallbacks.

let GoogleGenAI;
let aiClient = null;
try {
  // attempt require
  const mod = require("@google/genai");
  GoogleGenAI = mod.GoogleGenAI || mod.default || mod;
} catch (e) {
  GoogleGenAI = null;
}

const { GOOGLE_GENAI_KEY } = require("./config");

if (GoogleGenAI) {
  try {
    aiClient = new GoogleGenAI({ apiKey: GOOGLE_GENAI_KEY });
  } catch (e) {
    console.warn("Could not initialize GoogleGenAI client:", e.message);
    aiClient = null;
  }
} else {
  console.warn("Warning: @google/genai not installed or not loadable. AI evaluation will return safe defaults.");
}

/**
 * Ask Gemini (or fallback) to evaluate whether a play is a "good play".
 * Returns an object: { goodPlay: boolean, reason: string, score: number }
 */
async function evaluatePlay({ playMeta, transcript }) {
  // If no AI client, return safe default (not a highlight)
  if (!aiClient) {
    return { goodPlay: false, reason: "AI unavailable (fallback)", score: 0 };
  }

  const prompt = `
You are a sports-play classifier. Given the following play information and the announcer's commentary transcript, answer whether this play is a "good play" worth creating a highlight clip for.

Return ONLY a JSON object (no extra text) with fields:
- goodPlay: true or false
- reason: a short 1-2 sentence reason
- score: a number 0..1 indicating confidence

Play metadata:
${JSON.stringify(playMeta, null, 2)}

Commentary transcript:
"""${transcript}"""
`;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = (response?.text) || (response?.output?.[0]?.content?.[0]?.text) || "";
    // Extract JSON substring (last { ... })
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e) {
        // fallthrough
      }
    }
    // As another fallback, attempt to parse first { ... }
    const jStart = text.indexOf("{");
    if (jStart >= 0) {
      try {
        return JSON.parse(text.substring(jStart));
      } catch (e) { /* continue */ }
    }

    return { goodPlay: false, reason: "Could not parse AI response", score: 0 };
  } catch (err) {
    console.error("AI evaluation error:", err.message);
    return { goodPlay: false, reason: "AI evaluation error", score: 0 };
  }
}

module.exports = {
  evaluatePlay,
};
