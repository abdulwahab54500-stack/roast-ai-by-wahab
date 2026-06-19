// netlify/functions/speak.js
//
// Receives: POST { text: "<string with optional [cheerful] tag>" }
// Calls Groq Orpheus TTS (canopylabs/orpheus-v1-english)
// Returns: binary WAV audio (base64-encoded, isBase64Encoded: true)

const GROQ_TTS = "https://api.groq.com/openai/v1/audio/speech";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST." }) };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GROQ_API_KEY not set." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON." }) };
  }

  const rawText = (payload.text || "").trim();
  if (!rawText) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing 'text' field." }) };
  }

  // Ensure [cheerful] is present for a fun tone; Orpheus supports vocal directions
  const ttsInput = rawText.startsWith("[") ? rawText : "[cheerful] " + rawText;
  // Truncate to 3000 chars to stay well within limits
  const ttsText = ttsInput.slice(0, 3000);

  let response;
  try {
    response = await fetch(GROQ_TTS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           "canopylabs/orpheus-v1-english",
        input:           ttsText,
        voice:           "troy",        // confident, energetic male voice
        response_format: "wav",
      }),
    });
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Could not reach Groq TTS: " + (e && e.message) }),
    };
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 429) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "TTS rate limited — ek minute baad dobara." }),
      };
    }
    return {
      statusCode: response.status,
      body: JSON.stringify({ error: "TTS failed: " + errText.slice(0, 200) }),
    };
  }

  // Return binary WAV as base64 for Netlify functions
  const audioArrayBuffer = await response.arrayBuffer();
  const base64Audio      = Buffer.from(audioArrayBuffer).toString("base64");

  return {
    statusCode:      200,
    headers:         { "Content-Type": "audio/wav" },
    body:            base64Audio,
    isBase64Encoded: true,
  };
};
