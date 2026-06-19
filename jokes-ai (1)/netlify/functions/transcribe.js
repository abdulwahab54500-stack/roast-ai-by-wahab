// netlify/functions/transcribe.js
//
// Receives: POST { audio: "<base64 string>", mimeType: "audio/webm" }
// Calls Groq Whisper (whisper-large-v3-turbo) for multilingual speech-to-text
// Returns: { text: "<transcribed string>" }

const GROQ_TRANSCRIBE = "https://api.groq.com/openai/v1/audio/transcriptions";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST." }) };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "GROQ_API_KEY not set. Add it in Netlify Site settings → Environment variables.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON." }) };
  }

  const { audio, mimeType } = payload;
  if (!audio) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing 'audio' field." }) };
  }

  let response;
  try {
    // Decode base64 → Buffer → Blob (Node 18 has global Blob)
    const audioBuffer = Buffer.from(audio, "base64");
    const ext = (mimeType || "audio/webm").includes("mp4")
      ? "audio.mp4"
      : (mimeType || "").includes("ogg")
      ? "audio.ogg"
      : "audio.webm";

    const blob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });

    const formData = new FormData();
    formData.append("file", blob, ext);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");
    // language not specified → Whisper auto-detects (supports Urdu, English, Arabic, etc.)

    response = await fetch(GROQ_TRANSCRIBE, {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    formData,
    });
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Could not reach Groq API: " + (e && e.message) }),
    };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 429) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Rate limited — ek minute baad dobara koshish karein." }),
      };
    }
    return {
      statusCode: response.status,
      body: JSON.stringify({ error: (data.error && data.error.message) || "Transcription failed." }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: data.text || "" }),
  };
};
