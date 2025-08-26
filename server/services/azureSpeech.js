import fetch from "node-fetch";
import { bufferToWav } from "../utils/toWav.js";

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION; // z. B. germanywestcentral

export async function transcribeWithAzure(audioBuffer, mimeType, hintLang) {
  if (!KEY || !REGION) throw new Error("Azure Speech ENV Variablen fehlen");
  if (!audioBuffer?.length) throw new Error("Keine Audiodaten");

  // ⚠️ Immer in WAV konvertieren → beseitigt Codec-Probleme
  const wavBuffer = await bufferToWav(
    audioBuffer,
    mimeType?.includes("ogg") ? ".ogg" : (mimeType?.includes("webm") ? ".webm" : ".bin")
  );

  const language = hintLang || "de-DE";
  const url = `https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "audio/wav",
      "Accept": "application/json",
    },
    body: wavBuffer,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Azure Speech Fehler ${res.status}: ${t || res.statusText}`);
  }

  const data = await res.json();
  if (data.RecognitionStatus !== "Success" || !data.DisplayText) {
    throw new Error(`Transkription fehlgeschlagen: ${data.RecognitionStatus || "Unknown"}`);
  }
  return { text: data.DisplayText, language };
}
