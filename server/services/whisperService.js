// server/services/whisperService.js
export async function transcribeAutoWithWhisper(audioBuffer, filename = "audio.webm") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY fehlt");
    }
  
    // Buffer -> Blob (für FormData)
    const file = new Blob([audioBuffer], { type: "application/octet-stream" });
  
    const form = new FormData();
    form.append("file", file, filename);
    form.append("model", "whisper-1");
    // verbose_json liefert auch die erkannte Sprache zurück
    form.append("response_format", "verbose_json");
  
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
  
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Whisper Fehler ${res.status}: ${t || res.statusText}`);
    }
  
    const data = await res.json(); // { text, language, segments, ... }
    return {
      text: data.text || "",
      language: data.language || "", // z.B. "fa", "tr", "ku", "es", "it", "en", "de"
    };
  }
  