# Jokes AI — Powered by Wahab AI

Aik free, no-login, **voice-to-voice** funny AI chatbot. Har sawal ka jawab funny milega — Trump style! Made by Abdul Wahab. Koi bhi language bolein — Urdu, Roman Urdu, English, ya koi bhi — Trump jawab deta hai!

---

## Kya kya features hain

- **Voice to Voice** — mic dabao, bolo, Trump bol ke jawab deta hai (Orpheus TTS)
- **Text fallback** — neeche text box bhi hai agar mic na ho
- **Multilingual** — Urdu, English, Roman Urdu, har language
- **Sirf funny** — serious sawal bhi funny answer milega
- **No login, no account** — koi bhi use kare, unlimited

---

## Groq free API key kaise len (5 minute)

1. [console.groq.com](https://console.groq.com) kholein
2. Free signup karein (Google se bhi chalega) — koi card nahi
3. **API Keys** section mein jayen → **Create API Key** → copy karein
4. Key safe rakhein

---

## Netlify par deploy karna

**ZAROORI BAAT:** Site mein 3 serverless functions hain (transcribe, joke, speak). Isliye plain drag-drop nahi chalega — neeche wale 2 tareeqon mein se koi ek use karein.

### Option A — GitHub se (recommended)

1. Is folder ko GitHub par naya repo banayen aur upload karein
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
3. Apna repo chunein, build settings khaali rakhein (netlify.toml sab handle karta hai)
4. **Deploy** dabayein
5. Deploy hone ke baad: **Site settings → Environment variables → Add variable**
   - Key: `GROQ_API_KEY`
   - Value: (jo Groq se copy ki thi)
6. **Deploys → Trigger deploy** (ek dafa redeploy karein taake key active ho)
7. Done! Netlify jo URL deta hai woh aap ki live site hai

### Option B — Netlify CLI se

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```
Phir Netlify dashboard mein `GROQ_API_KEY` add karein aur dobara `netlify deploy --prod` karein.

### Local test (optional)

```bash
# .env file banayein (project folder mein):
# GROQ_API_KEY=your_key_here

netlify dev
```

---

## Technical details (jis ne samajhna ho)

- **Speech-to-text:** Groq Whisper Large v3 Turbo (free, 2000 req/day, all languages)
- **AI brain:** Groq Llama 3.3 70B (funny Trump persona, free, ~1000 req/day)
- **Text-to-speech:** Groq Orpheus v1 English (free, LPU-fast, [cheerful] vocal direction)
- **Browser fallback:** Agar Orpheus kisi wajah se na chale, browser ka built-in SpeechSynthesis use hota hai

**Note:** "Unlimited" ka matlab — end users ke liye koi account nahi, lekin Groq free tier ki daily limits hain. Normal/personal use ke liye generous hain. Limit hit ho to friendly message deta hai.

---

## Customize karna

- **Colors/theme:** `style.css` mein `:root { ... }` ke variables (`--yellow`, `--pink`, `--bg`, etc.)
- **AI personality:** `netlify/functions/joke.js` mein `SYSTEM_PROMPT`
- **Voice:** `speak.js` mein `voice: "miles"` → `"austin"`, `"luna"`, `"sky"`, `"sage"`, `"river"`, ya `"star"` mein se koi bhi
