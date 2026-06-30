// gemini.js — thin wrapper around the Gemini API (Google AI Studio / Vertex-compatible).
// Set GEMINI_API_KEY in .env to make this live. Without it, falls back to a clearly-labeled
// offline stub so the rest of the app (UI, DB, payments) can still be demoed and tested.
const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const hasLiveKey = Boolean(API_KEY && API_KEY.length > 10);

/**
 * Calls Gemini with a system instruction + user content.
 * Returns { text, latencyMs, model, live }.
 */
async function callGemini({ systemInstruction, userContent, temperature = 0.3, maxOutputTokens = 1024 }) {
  const start = Date.now();

  if (!hasLiveKey) {
    // Offline stub — clearly labeled, deterministic enough for demo purposes.
    const stub = buildOfflineStub({ systemInstruction, userContent });
    return {
      text: stub,
      latencyMs: Date.now() - start,
      model: 'offline-stub',
      live: false,
    };
  }

  try {
    const response = await axios.post(
      `${BASE_URL}?key=${API_KEY}`,
      {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: { temperature, maxOutputTokens },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
      '(no response generated)';

    return {
      text,
      latencyMs: Date.now() - start,
      model: MODEL,
      live: true,
    };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    return {
      text: `[Agent error — Gemini call failed: ${message}]`,
      latencyMs: Date.now() - start,
      model: MODEL,
      live: true,
      error: true,
    };
  }
}

function buildOfflineStub({ userContent }) {
  return (
    `[OFFLINE MODE — no GEMINI_API_KEY set in .env]\n\n` +
    `This is a placeholder response so you can test the full app flow without burning API quota. ` +
    `Add your real Gemini API key to backend/.env as GEMINI_API_KEY=... and restart the server ` +
    `to get real AI responses.\n\nYour message was: "${userContent.slice(0, 200)}"`
  );
}

module.exports = { callGemini, hasLiveKey, MODEL };
