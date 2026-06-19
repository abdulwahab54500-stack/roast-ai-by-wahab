/* =====================================================
   JOKES AI — app.js
   Voice flow: record → transcribe → joke → speak
   Text fallback also supported
   ===================================================== */

(function () {
  "use strict";

  // ── DOM refs ──────────────────────────────────────────
  const micBtn     = document.getElementById("micBtn");
  const micIcon    = document.getElementById("micIcon");
  const stopIcon   = document.getElementById("stopIcon");
  const waveIcon   = document.getElementById("waveIcon");
  const stage      = document.getElementById("stage");
  const spotlight  = document.getElementById("spotlight");
  const statusLine = document.getElementById("statusLine");
  const bubblesEl  = document.getElementById("bubbles");
  const textInput  = document.getElementById("textInput");
  const sendBtn    = document.getElementById("sendBtn");

  // ── App state ─────────────────────────────────────────
  let appState    = "idle"; // idle | recording | transcribing | thinking | speaking
  let recorder    = null;
  let audioChunks = [];
  let currentAudio = null;
  let thinkingBubble = null;

  // ── Helpers ───────────────────────────────────────────
  function setStatus(msg, type = "") {
    statusLine.textContent = msg;
    statusLine.className   = "status-line" + (type ? " " + type : "");
  }

  function setState(s) {
    appState = s;
    stage.className = "stage" + (["recording","speaking","thinking"].includes(s) ? " " + s : "");

    // mic button icons
    micIcon.style.display  = s === "idle"      ? "" : "none";
    stopIcon.style.display = s === "recording" ? "" : "none";
    waveIcon.style.display = s === "speaking"  ? "" : "none";

    micBtn.disabled = s === "transcribing" || s === "thinking";

    switch (s) {
      case "idle":
        setStatus("Tap the mic — Trump is ready to make you laugh 😂");
        break;
      case "recording":
        setStatus("🔴 Sun raha hoon... (tap to stop)", "active");
        break;
      case "transcribing":
        setStatus("✍️ Samajh raha hoon aap ne kya kaha...", "active");
        break;
      case "thinking":
        setStatus("🤔 Trump soch raha hai... (jo ke rarely hota hai 😆)", "ai");
        break;
      case "speaking":
        setStatus("🔊 Trump bol raha hai — tap to skip", "ai");
        break;
    }
  }

  // Remove vocal direction tags like [cheerful] from display text
  function stripTags(text) {
    return text.replace(/\[[^\]]+\]/g, "").trim();
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "bubble " + role;
    div.textContent = role === "ai" ? stripTags(text) : text;
    bubblesEl.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
    return div;
  }

  function showThinking() {
    thinkingBubble = document.createElement("div");
    thinkingBubble.className = "bubble thinking-bubble ai";
    thinkingBubble.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
    bubblesEl.appendChild(thinkingBubble);
    thinkingBubble.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function removeThinking() {
    if (thinkingBubble) {
      thinkingBubble.remove();
      thinkingBubble = null;
    }
  }

  // ── Get best supported audio MIME type ────────────────
  function getSupportedMimeType() {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || "";
  }

  // ── Blob → base64 ─────────────────────────────────────
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ── Friendly error messages ───────────────────────────
  function friendlyError(err, status) {
    if (status === 429) return "Ek minute baad dobara koshish karein — Trump ke jokes itne popular hain ke server busy ho gaya 😅";
    if (!navigator.onLine) return "Internet connection check karein 🌐";
    return "Kuch masla aa gaya... Trump ne shayad system crash kar diya 😂 Dobara koshish karein!";
  }

  // ── Core: transcribe audio blob ───────────────────────
  async function transcribeAudio(blob, mimeType) {
    const base64 = await blobToBase64(blob);
    const res = await fetch("/api/transcribe", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ audio: base64, mimeType: mimeType || "audio/webm" }),
    });
    if (!res.ok) throw Object.assign(new Error("Transcription failed"), { status: res.status });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return (data.text || "").trim();
  }

  // ── Core: get funny reply ─────────────────────────────
  async function getJoke(userText) {
    const res = await fetch("/api/joke", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: userText }),
    });
    if (!res.ok) throw Object.assign(new Error("Joke fetch failed"), { status: res.status });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.reply || "";
  }

  // ── Core: speak text via Orpheus TTS ─────────────────
  async function speakText(text) {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch("/api/speak", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ text }),
        });
        if (!res.ok) {
          // fallback to browser TTS
          browserSpeak(stripTags(text), resolve);
          return;
        }
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        currentAudio = new Audio(url);
        currentAudio.onended  = () => { URL.revokeObjectURL(url); resolve(); };
        currentAudio.onerror  = () => {
          URL.revokeObjectURL(url);
          browserSpeak(stripTags(text), resolve);
        };
        await currentAudio.play().catch(() => {
          // Autoplay blocked — show play button fallback
          URL.revokeObjectURL(url);
          browserSpeak(stripTags(text), resolve);
        });
      } catch (e) {
        browserSpeak(stripTags(text), resolve);
      }
    });
  }

  // Browser SpeechSynthesis fallback (works for Urdu etc.)
  function browserSpeak(text, onEnd) {
    if (!window.speechSynthesis) { onEnd && onEnd(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 1.05;
    utt.pitch = 1.1;
    utt.onend = () => onEnd && onEnd();
    window.speechSynthesis.speak(utt);
  }

  // ── Stop speaking ─────────────────────────────────────
  function stopSpeaking() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setState("idle");
  }

  // ── Main flow: text → joke → speak ───────────────────
  async function processText(userText) {
    if (!userText) return;
    addBubble("user", userText);

    showThinking();
    setState("thinking");

    let reply;
    try {
      reply = await getJoke(userText);
    } catch (err) {
      removeThinking();
      setStatus(friendlyError(err, err.status), "error");
      setState("idle");
      return;
    }

    removeThinking();
    addBubble("ai", reply);

    setState("speaking");
    try {
      await speakText(reply);
    } catch (_) {
      // ignore speak errors
    }
    setState("idle");
  }

  // ── Recording flow ────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      const mimeType = getSupportedMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const usedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunks, { type: usedMimeType });

        if (blob.size < 500) {
          setStatus("Kuch suna nahi — dobara koshish karein 🎤", "error");
          setState("idle");
          return;
        }

        setState("transcribing");
        let text;
        try {
          text = await transcribeAudio(blob, usedMimeType);
        } catch (err) {
          setStatus(friendlyError(err, err.status), "error");
          setState("idle");
          return;
        }

        if (!text) {
          setStatus("Kuch samajh nahi aaya — phir se bolein 😅", "error");
          setState("idle");
          return;
        }

        await processText(text);
      };

      recorder.start(250); // collect data every 250ms
      setState("recording");
    } catch (err) {
      // Mic permission denied or not available
      const banner = document.createElement("div");
      banner.className = "mic-error";
      banner.textContent = "Microphone access nahi mila 😕 — Neeche text type kar ke bhi baat kar sakte hain!";
      bubblesEl.prepend(banner);
      setStatus("Mic nahi mila — type karein neeche", "error");
      setState("idle");
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  // ── Mic button click ──────────────────────────────────
  micBtn.addEventListener("click", () => {
    if (appState === "idle")      startRecording();
    else if (appState === "recording") stopRecording();
    else if (appState === "speaking")  stopSpeaking();
  });

  // ── Text input fallback ───────────────────────────────
  async function handleTextSend() {
    const text = textInput.value.trim();
    if (!text || appState !== "idle") return;
    textInput.value = "";
    await processText(text);
  }

  sendBtn.addEventListener("click", handleTextSend);
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  });

  // ── Init ──────────────────────────────────────────────
  setState("idle");

})();
