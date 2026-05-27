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
          create_response: false,
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

/** Frontend-safe code when OpenAI rejects the call for billing/quota (HTTP 429). */
export const OPENAI_QUOTA_EXCEEDED_ERROR = "OPENAI_QUOTA_EXCEEDED";

function isOpenAiQuotaExceeded(openaiStatus, openaiErrorCode, openaiErrorMessage) {
  if (openaiErrorCode === "insufficient_quota") return true;
  if (openaiStatus !== 429) return false;
  const message = String(openaiErrorMessage || "").toLowerCase();
  return /quota|billing/.test(message);
}

function isInvalidModelError(minted) {
  const msg = String(minted.openaiErrorMessage || "").toLowerCase();
  const param = String(minted.openaiErrorParam || "").toLowerCase();
  const code = String(minted.openaiErrorCode || "").toLowerCase();
  return (
    param.includes("model") ||
    code === "invalid_value" ||
    code === "model_not_found" ||
    /invalid.*model|model.*not found|does not exist|not available|not supported/.test(msg)
  );
}

function classifyOpenAiConnectionError(minted) {
  const status = minted.openaiStatus;
  const code = minted.openaiErrorCode;
  const msg = String(minted.openaiErrorMessage || "").toLowerCase();
  if (status === 401 || code === "invalid_api_key") return "unauthorized";
  if (isOpenAiQuotaExceeded(status, code, minted.openaiErrorMessage)) return "insufficient_credits";
  if (isInvalidModelError(minted)) return "invalid_model";
  if (status === 400 && (msg.includes("session") || msg.includes("parameter"))) return "invalid_session_payload";
  if (status === 403 || (msg.includes("realtime") && msg.includes("disabled"))) return "realtime_disabled";
  return "openai_error";
}

async function postClientSecrets(apiKey, payload, options = {}) {
  const bodyString = JSON.stringify(payload);
  const mintStartedAt = Date.now();
  console.log(
    JSON.stringify({
      tag: "[MedaPayloadOutgoing]",
      url: OPENAI_CLIENT_SECRETS_URL,
      model: payload?.session?.model ?? null,
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
        connectionErrorKind: classifyOpenAiConnectionError({
          openaiStatus: openaiRes.status,
          ...sanitizeOpenAiError(data),
        }),
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
    mintStartedAt,
    ...sanitizeOpenAiError(data),
  };
}

/**
 * @param {string} apiKey
 * @param {ReturnType<typeof buildRealtimeClientSecretsPayload>["payload"]} payload
 * @param {{ userId?: string }} [options]
 */
export async function mintRealtimeClientSecret(apiKey, payload, options = {}) {
  let minted = await postClientSecrets(apiKey, payload, options);

  if (!minted.ok && isInvalidModelError(minted)) {
    const fallbackModel = resolveOpenAiRealtimeModel("gpt-4o-realtime-preview");
    const currentModel = payload?.session?.model;
    if (currentModel && currentModel !== fallbackModel) {
      console.log(
        JSON.stringify({
          tag: "[MedaRealtimeModelFallback]",
          fromModel: currentModel,
          toModel: fallbackModel,
          openaiStatus: minted.openaiStatus,
          openaiErrorCode: minted.openaiErrorCode,
          openaiErrorMessage: minted.openaiErrorMessage,
        }),
      );
      minted = await postClientSecrets(
        apiKey,
        { ...payload, session: { ...payload.session, model: fallbackModel } },
        options,
      );
      minted.usedFallbackModel = fallbackModel;
    }
  }

  return minted;
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
    const quotaExceeded = isOpenAiQuotaExceeded(
      minted.openaiStatus,
      minted.openaiErrorCode,
      minted.openaiErrorMessage,
    );
    return {
      ok: false,
      phase: "client_secrets",
      openaiStatus: minted.openaiStatus,
      openaiErrorCode: minted.openaiErrorCode,
      openaiErrorParam: minted.openaiErrorParam,
      openaiErrorMessage: minted.openaiErrorMessage,
      connectionErrorKind: classifyOpenAiConnectionError(minted),
      ...(quotaExceeded ? { error: OPENAI_QUOTA_EXCEEDED_ERROR } : {}),
    };
  }

  const secretAgeMs =
    typeof minted.mintStartedAt === "number" ? Date.now() - minted.mintStartedAt : null;
  console.log(
    JSON.stringify({
      tag: "[MedaRealtimeCallsStart]",
      secretAgeMs,
      expiresAt: minted.expiresAt ?? null,
      model: sessionPayload?.session?.model ?? null,
      usedFallbackModel: minted.usedFallbackModel ?? null,
      offerBytes: offerSdp.length,
    }),
  );

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
    let parsed = {};
    try {
      parsed = JSON.parse(answerSdp);
    } catch {
      /* not JSON */
    }
    const sanitized = sanitizeOpenAiError(parsed);
    const quotaExceeded = isOpenAiQuotaExceeded(
      callsRes.status,
      sanitized.openaiErrorCode,
      sanitized.openaiErrorMessage,
    );
    console.log(
      JSON.stringify({
        tag: "[MedaOpenAIRawResponse]",
        phase: "realtime_calls",
        status: callsRes.status,
        connectionErrorKind: classifyOpenAiConnectionError({
          openaiStatus: callsRes.status,
          ...sanitized,
        }),
        body: answerSdp,
      }),
    );
    return {
      ok: false,
      phase: "realtime_calls",
      openaiStatus: callsRes.status,
      openaiErrorCode: sanitized.openaiErrorCode,
      openaiErrorMessage: sanitized.openaiErrorMessage,
      connectionErrorKind: classifyOpenAiConnectionError({
        openaiStatus: callsRes.status,
        ...sanitized,
      }),
      answerSdp: "",
      ...(quotaExceeded ? { error: OPENAI_QUOTA_EXCEEDED_ERROR } : {}),
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
