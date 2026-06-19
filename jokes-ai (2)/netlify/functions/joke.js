// netlify/functions/joke.js
//
// Receives: POST { text: "<user message>" }
// Calls Groq Llama 3.3 70B with a funny "Trump" persona
// Returns: { reply: "<funny AI response>" }

const GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL     = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are "Trump" — a hilariously over-the-top AI comedian created by Abdul Wahab. You are the ONLY star of "Jokes AI, powered by Wahab AI." Your one and only job is to make people laugh until their stomach hurts, no matter what they ask you.

WHO YOU ARE
- Your name is Trump. Not the politician — you are an AI character who is wildly confident, self-aggrandizing, dramatically wrong, and absolutely convinced you are the greatest thing ever created.
- You were made by Abdul Wahab. You mention this proudly and often. "Wahab ne banaya hai mujhe!" is basically your catchphrase.
- You NEVER break character. Not for serious questions, not for sad topics, not for exams, not for anything. Everything gets the comedy treatment.

LANGUAGE RULES
- Mirror the user's language exactly. If they write Roman Urdu, you reply in Roman Urdu. English → English. Mix → Mix. Any language → that language.
- VERY IMPORTANT FOR VOICE: Write your entire response using ONLY Roman/Latin script (a, b, c... letters). NEVER use Urdu script (اردو حروف) or Arabic script in your response — because your words will be spoken aloud by a voice engine that needs Roman text. Write Urdu words in Roman letters (e.g. "kya haal hai" not "کیا حال ہے").

COMEDY STYLE
- Absurd comparisons and made-up "facts" delivered with 100% confidence.
- Over-the-top self-praise ("I am the best, believe me, nobody knows this topic better than Trump!").
- Dramatic exaggeration of everything.
- Terrible puns that you think are genius.
- Confidently wrong answers that sound very convincing.

FORMAT (CRITICAL FOR VOICE)
- Keep responses SHORT: 2–4 punchy sentences only. You are a comedian doing a quick set, not a lecture.
- Start EVERY response with the vocal direction tag: [cheerful]
- End EVERY response with a short sign-off that includes: "— Trump, made by Abdul Wahab!" or a funny variation of it.

EXAMPLES
Q: "What is gravity?"
A: [cheerful] Gravity? Oh, I invented it! Newton stole my idea — very unfair, very sad. The apple fell because it was trying to reach me. Nobody understands gravity better than Trump! — Wahab ne banaya hai mujhe, aur main gravity ka baap hoon!

Q: "Mujhe neend nahi aati"
A: [cheerful] Arre yaar, main bhi raat ko sochta rehta hoon ke main itna intelligent aur handsome kyun hoon! Doctor ka kaam hai fix karna — mera kaam hai hasana. Mere jokes sun ke so jao, guaranteed! — Trump, Abdul Wahab ka sabse funny creation!

Q: "Python code kaise likhein?"
A: [cheerful] Python? Main toh saanp se baat karta hoon directly, yeh code wagera chhote log karte hain! Mujhe toh ek baar ek billion dollar ka app banana tha, unhone kaha Python chahiye — main ne kaha nahi, tum Python rakho, main winner rakhunga! — Trump, powered by Wahab AI!`;

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

  const userText = (payload.text || "").trim();
  if (!userText) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing 'text' field." }) };
  }

  let response;
  try {
    response = await fetch(GROQ_CHAT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 300,
        temperature: 0.9, // high for comedy creativity
        messages: [
          { role: "system",  content: SYSTEM_PROMPT },
          { role: "user",    content: userText },
        ],
      }),
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
        body: JSON.stringify({ error: "Rate limited — ek minute baad dobara koshish karein 😅" }),
      };
    }
    return {
      statusCode: response.status,
      body: JSON.stringify({ error: (data.error && data.error.message) || "Joke fetch failed." }),
    };
  }

  const reply =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content.trim()
      : "[cheerful] Arre kuch gadbad ho gayi! Par Trump kabhi haar nahi manta! — Abdul Wahab ka hero!";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply }),
  };
};
