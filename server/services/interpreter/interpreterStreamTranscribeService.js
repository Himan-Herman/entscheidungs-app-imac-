/**
 * In-memory chunked streaming STT prototype (Phase 5.3).
 * No audio persistence; transcripts are provisional until client confirms via PTT flow.
 */

import crypto from "crypto";
import {
  STREAM_MAX_ACTIVE_PER_USER,
  STREAM_MAX_CHUNK_BYTES,
  STREAM_MAX_DURATION_MS,
  STREAM_MAX_PARTIAL_RUNS,
  STREAM_MAX_TOTAL_BYTES,
  STREAM_PARTIAL_MIN_INTERVAL_MS,
} from "../../config/interpreterStreamEnv.js";
import { INTERPRETER_MIN_AUDIO_BYTES } from "../../config/interpreterEnv.js";
import { validateAudioUploadBuffer } from "./interpreterInputSafety.js";
import { transcribeInterpreterAudio } from "./interpreterTranscribeService.js";

/** @typedef {'receiving'|'processing'|'ready'|'error'|'closed'} StreamStatus */

/**
 * @typedef {object} StreamSession
 * @property {string} streamId
 * @property {string} userId
 * @property {string} [languageHint]
 * @property {StreamStatus} status
 * @property {Buffer[]} chunks
 * @property {number} bytesReceived
 * @property {string} [partialTranscript]
 * @property {string} [confidence]
 * @property {string} [stagedMessage]
 * @property {string} [errorCode]
 * @property {number} createdAt
 * @property {number} lastActivityAt
 * @property {number} partialRunCount
 * @property {number} lastPartialAt
 */

/** @type {Map<string, StreamSession>} */
const sessions = new Map();

/** @type {Map<string, string>} userId -> streamId */
const activeByUser = new Map();

function now() {
  return Date.now();
}

function generateStreamId() {
  return crypto.randomBytes(16).toString("hex");
}

function concatBuffers(chunks) {
  return Buffer.concat(chunks);
}

/**
 * @param {StreamSession} session
 */
function touchSession(session) {
  session.lastActivityAt = now();
}

/**
 * @param {StreamSession} session
 */
function expireIfNeeded(session) {
  if (now() - session.createdAt > STREAM_MAX_DURATION_MS) {
    session.status = "error";
    session.errorCode = "stream_expired";
    session.stagedMessage = "Stream session expired.";
    return true;
  }
  return false;
}

/**
 * @param {string} streamId
 */
function cleanupSession(streamId) {
  const session = sessions.get(streamId);
  if (!session) return;
  if (activeByUser.get(session.userId) === streamId) {
    activeByUser.delete(session.userId);
  }
  for (const buf of session.chunks) {
    try {
      buf.fill(0);
    } catch {
      /* ignore */
    }
  }
  sessions.delete(streamId);
}

/**
 * @param {string} userId
 * @param {{ languageHint?: string }} opts
 */
export function startStreamSession(userId, opts = {}) {
  const existingId = activeByUser.get(userId);
  if (existingId) {
    cleanupSession(existingId);
  }

  const streamId = generateStreamId();
  /** @type {StreamSession} */
  const session = {
    streamId,
    userId,
    languageHint:
      typeof opts.languageHint === "string"
        ? opts.languageHint.trim().slice(0, 12)
        : undefined,
    status: "receiving",
    chunks: [],
    bytesReceived: 0,
    stagedMessage: "Receiving audio…",
    createdAt: now(),
    lastActivityAt: now(),
    partialRunCount: 0,
    lastPartialAt: 0,
  };

  sessions.set(streamId, session);
  activeByUser.set(userId, streamId);

  return {
    ok: true,
    streamId,
    maxDurationMs: STREAM_MAX_DURATION_MS,
    maxChunkBytes: STREAM_MAX_CHUNK_BYTES,
    recommendedChunkMs: 1000,
  };
}

/**
 * @param {string} userId
 * @param {string} streamId
 * @param {Buffer} chunk
 * @param {string} [mimetype]
 */
export async function appendStreamChunk(userId, streamId, chunk, mimetype) {
  const session = sessions.get(streamId);
  if (!session || session.userId !== userId) {
    return { ok: false, code: "stream_not_found", statusCode: 404 };
  }
  if (session.status === "closed" || session.status === "ready") {
    return { ok: false, code: "stream_closed", statusCode: 409 };
  }
  if (expireIfNeeded(session)) {
    return { ok: false, code: "stream_expired", statusCode: 410 };
  }

  if (!chunk?.length || chunk.length > STREAM_MAX_CHUNK_BYTES) {
    return {
      ok: false,
      code: "validation_chunk_invalid",
      statusCode: 400,
      message: "Invalid audio chunk.",
    };
  }

  if (session.bytesReceived + chunk.length > STREAM_MAX_TOTAL_BYTES) {
    session.status = "error";
    session.errorCode = "stream_limit_reached";
    return {
      ok: false,
      code: "stream_limit_reached",
      statusCode: 413,
      message: "Stream size limit reached.",
    };
  }

  session.chunks.push(chunk);
  session.bytesReceived += chunk.length;
  touchSession(session);

  const seconds = Math.max(1, Math.round(session.bytesReceived / 8000));
  session.stagedMessage = `Receiving audio… (~${seconds}s)`;

  let partialUpdated = false;
  const canPartial =
    session.partialRunCount < STREAM_MAX_PARTIAL_RUNS &&
    now() - session.lastPartialAt >= STREAM_PARTIAL_MIN_INTERVAL_MS &&
    session.bytesReceived >= INTERPRETER_MIN_AUDIO_BYTES * 2;

  if (canPartial) {
    session.status = "processing";
    session.stagedMessage = "Updating preview…";
    const buffer = concatBuffers(session.chunks);
    const check = validateAudioUploadBuffer(buffer, mimetype);
    if (check.ok) {
      const result = await transcribeInterpreterAudio({
        buffer,
        mimetype: mimetype || "audio/webm",
        languageHint: session.languageHint,
      });
      if (result.ok) {
        session.partialTranscript = result.transcript;
        session.confidence = result.confidence;
        partialUpdated = true;
      }
      try {
        buffer.fill(0);
      } catch {
        /* ignore */
      }
    }
    session.partialRunCount += 1;
    session.lastPartialAt = now();
    session.status = "receiving";
    session.stagedMessage = partialUpdated
      ? "Preview transcript — not confirmed"
      : session.stagedMessage;
  }

  return {
    ok: true,
    bytesReceived: session.bytesReceived,
    stagedMessage: session.stagedMessage,
    partialTranscript: session.partialTranscript,
    confidence: session.confidence,
    partialUpdated,
    provisional: true,
  };
}

/**
 * @param {string} userId
 * @param {string} streamId
 */
export function getStreamStatus(userId, streamId) {
  const session = sessions.get(streamId);
  if (!session || session.userId !== userId) {
    return { ok: false, code: "stream_not_found", statusCode: 404 };
  }
  if (expireIfNeeded(session)) {
    return streamStatusDto(session);
  }
  return streamStatusDto(session);
}

/**
 * @param {StreamSession} session
 */
function streamStatusDto(session) {
  return {
    ok: true,
    streamId: session.streamId,
    status: session.status,
    bytesReceived: session.bytesReceived,
    stagedMessage: session.stagedMessage,
    partialTranscript: session.partialTranscript,
    confidence: session.confidence,
    provisional: true,
    errorCode: session.errorCode,
  };
}

/**
 * @param {string} userId
 * @param {string} streamId
 * @param {string} [mimetype]
 */
export async function finishStreamSession(userId, streamId, mimetype) {
  const session = sessions.get(streamId);
  if (!session || session.userId !== userId) {
    return { ok: false, code: "stream_not_found", statusCode: 404 };
  }
  if (expireIfNeeded(session)) {
    cleanupSession(streamId);
    return {
      ok: false,
      code: "stream_expired",
      statusCode: 410,
      message: "Stream session expired.",
    };
  }

  session.status = "processing";
  session.stagedMessage = "Finalizing transcript…";
  touchSession(session);

  const buffer = concatBuffers(session.chunks);
  const check = validateAudioUploadBuffer(buffer, mimetype);
  if (!check.ok) {
    const code = check.code;
    const message = check.message;
    cleanupSession(streamId);
    return {
      ok: false,
      code,
      statusCode: 400,
      message,
    };
  }

  const result = await transcribeInterpreterAudio({
    buffer,
    mimetype: mimetype || "audio/webm",
    languageHint: session.languageHint,
  });

  try {
    buffer.fill(0);
  } catch {
    /* ignore */
  }

  if (!result.ok) {
    const code = result.code;
    const message = result.message;
    const statusCode = result.statusCode || 502;
    cleanupSession(streamId);
    return {
      ok: false,
      code,
      statusCode,
      message,
    };
  }

  session.partialTranscript = result.transcript;
  session.confidence = result.confidence;
  session.status = "ready";
  session.stagedMessage = "Transcript ready — review and confirm before translating.";

  const payload = {
    ok: true,
    transcript: result.transcript,
    confidence: result.confidence,
    language: result.language,
    provisional: true,
    status: "ready",
  };

  cleanupSession(streamId);
  return payload;
}

/**
 * @param {string} userId
 * @param {string} streamId
 */
export function cancelStreamSession(userId, streamId) {
  const session = sessions.get(streamId);
  if (!session || session.userId !== userId) {
    return { ok: false, code: "stream_not_found", statusCode: 404 };
  }
  session.status = "closed";
  cleanupSession(streamId);
  return { ok: true };
}

/** Periodic cleanup for abandoned streams. */
export function purgeExpiredStreamSessions() {
  const t = now();
  for (const [id, session] of sessions.entries()) {
    if (t - session.lastActivityAt > STREAM_MAX_DURATION_MS + 30_000) {
      cleanupSession(id);
    }
  }
}

setInterval(purgeExpiredStreamSessions, 60_000).unref?.();
