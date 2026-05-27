import {
  LIVE_TRANSLATION_CLIENT_SECRET_TTL_SECONDS,
  LIVE_TRANSLATION_REALTIME_MODEL,
  LIVE_TRANSLATION_TRANSCRIPTION_MODEL,
  LIVE_TRANSLATION_VAD_SILENCE_MS,
  LIVE_TRANSLATION_VAD_THRESHOLD,
  LIVE_TRANSLATION_VOICE,
} from "../../config/liveTranslationEnv.js";
import { buildLiveTranslationInstructions } from "./liveTranslationPrompt.js";
import { buildLanguageRouting } from "./liveTranslationRouting.js";

/** When patient and doctor languages differ, ASR must auto-detect (not lock to one side). */
function shouldLockTranscriptionLanguage(patientLanguage, doctorLanguage) {
  const patient = String(patientLanguage || "").trim().toLowerCase();
  const doctor = String(doctorLanguage || "").trim().toLowerCase();
  return Boolean(patient && doctor && patient === doctor);
}
import {
  resolveOpenAiRealtimeModel,
  resolveOpenAiRealtimeVoice,
  resolveOpenAiTranscriptionLanguage,
  resolveOpenAiTranscriptionModel,
} from "./openAiRealtimePayload.js";

const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/**
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} validated
 */
export function buildRealtimeClientSecretsPayload(validated) {
  const { patientLanguage, doctorLanguage, activeSpeaker } = validated;
  const routing = buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker });
  const instructions = buildLiveTranslationInstructions({
    patientLanguage,
    doctorLanguage,
    activeSpeaker,
  });

  const realtimeModel = resolveOpenAiRealtimeModel(LIVE_TRANSLATION_REALTIME_MODEL);
  const voice = resolveOpenAiRealtimeVoice(LIVE_TRANSLATION_VOICE);
  const transcriptionModel = resolveOpenAiTranscriptionModel(LIVE_TRANSLATION_TRANSCRIPTION_MODEL);
  const transcriptionLanguage = shouldLockTranscriptionLanguage(patientLanguage, doctorLanguage)
    ? resolveOpenAiTranscriptionLanguage(routing.sourceLanguage)
    : null;

  // POST /v1/realtime/client_secrets (GA): audio settings under session.audio.
  // Legacy flat session.voice / input_audio_transcription / turn_detection are rejected.

  // REALTIME_DEBUG_MINIMAL=true  → send only type+model+output_modalities to isolate which
  // additional fields are accepted. Set in .env while debugging, remove for production.
  const isDebugMinimal = process.env.REALTIME_DEBUG_MINIMAL === "true";

  const sessionConfig = {
    type: "realtime",
    model: realtimeModel,
    output_modalities: ["audio"],
  };

  if (!isDebugMinimal) {
    sessionConfig.instructions = instructions;
    sessionConfig.audio = {
      input: {
        transcription: {
          model: transcriptionModel,
          ...(transcriptionLanguage ? { language: transcriptionLanguage } : {}),
        },
        turn_detection: {
          type: "server_vad",
          create_response: true,
          interrupt_response: true,
          silence_duration_ms: LIVE_TRANSLATION_VAD_SILENCE_MS,
          prefix_padding_ms: 500,
          threshold: LIVE_TRANSLATION_VAD_THRESHOLD,
        },
      },
      output: { voice },
    };
  }

  const payload = {
    expires_after: {
      anchor: "created_at",
      seconds: LIVE_TRANSLATION_CLIENT_SECRET_TTL_SECONDS,
    },
    session: sessionConfig,
  };

  return {
    payload,
    routing,
    realtimeModel,
    voice,
    transcriptionModel,
    transcriptionLanguage,
  };
}

function sanitizeOpenAiError(data) {
  const err = data?.error;
  if (!err || typeof err !== "object") {
    return {
      openaiErrorType: null,
      openaiErrorCode: null,
      openaiErrorParam: null,
      openaiErrorMessage: null,
    };
  }
  return {
    openaiErrorType: typeof err.type === "string" ? err.type : null,
    openaiErrorCode: typeof err.code === "string" ? err.code : null,
    openaiErrorParam: typeof err.param === "string" ? err.param : null,
    openaiErrorMessage: typeof err.message === "string" ? err.message : null,
  };
}

/**
 * @param {string} apiKey
 * @param {ReturnType<typeof buildRealtimeClientSecretsPayload>["payload"]} payload
 * @param {{ userId?: string }} [options]
 */
export async function mintRealtimeClientSecret(apiKey, payload, options = {}) {
  const bodyString = JSON.stringify(payload);
  console.log(
    JSON.stringify({
      tag: "[MedaPayloadOutgoing]",
      url: OPENAI_CLIENT_SECRETS_URL,
      payloadJson: bodyString,
    }),
  );

  const openaiRes = await fetch(OPENAI_CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.userId ? { "OpenAI-Safety-Identifier": String(options.userId) } : {}),
    },
    body: bodyString,
  });

  const rawText = await openaiRes.text().catch(() => "");
  let data = {};
  try { data = JSON.parse(rawText); } catch { /* non-JSON body */ }

  if (!openaiRes.ok) {
    console.log(
      JSON.stringify({
        tag: "[MedaOpenAIRawResponse]",
        status: openaiRes.status,
        body: rawText,
      }),
    );
  }
  const clientSecret =
    data?.value || data?.client_secret?.value || data?.client_secret || null;
  const expiresAt = data?.expires_at || data?.client_secret?.expires_at || null;

  return {
    ok: openaiRes.ok && typeof clientSecret === "string" && clientSecret.length > 0,
    openaiStatus: openaiRes.status,
    clientSecret: typeof clientSecret === "string" ? clientSecret : null,
    expiresAt,
    ...sanitizeOpenAiError(data),
  };
}

/**
 * Server-side SDP exchange (recommended — avoids browser CORS to api.openai.com).
 * @param {string} apiKey
 * @param {string} offerSdp
 * @param {ReturnType<typeof buildRealtimeClientSecretsPayload>["payload"]} sessionPayload
 * @param {{ userId?: string }} [options]
 */
export async function exchangeRealtimeSdp(apiKey, offerSdp, sessionPayload, options = {}) {
  const minted = await mintRealtimeClientSecret(apiKey, sessionPayload, options);
  if (!minted.ok || !minted.clientSecret) {
    return {
      ok: false,
      phase: "client_secrets",
      openaiStatus: minted.openaiStatus,
      openaiErrorCode: minted.openaiErrorCode,
      openaiErrorParam: minted.openaiErrorParam,
      openaiErrorMessage: minted.openaiErrorMessage,
    };
  }

  const callsRes = await fetch(OPENAI_REALTIME_CALLS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${minted.clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offerSdp,
  });

  const answerSdp = await callsRes.text();
  if (!callsRes.ok) {
    let parsedMessage = null;
    try {
      const parsed = JSON.parse(answerSdp);
      parsedMessage = parsed?.error?.message ?? null;
    } catch {
      /* not JSON */
    }
    return {
      ok: false,
      phase: "realtime_calls",
      openaiStatus: callsRes.status,
      openaiErrorMessage: parsedMessage,
      answerSdp: "",
    };
  }

  if (!answerSdp.trim()) {
    return {
      ok: false,
      phase: "realtime_calls",
      openaiStatus: callsRes.status,
      openaiErrorMessage: "empty_sdp_answer",
      answerSdp: "",
    };
  }

  return {
    ok: true,
    openaiStatus: callsRes.status,
    answerSdp,
    expiresAt: minted.expiresAt,
  };
}
