import { authFetch } from "../../../api/authFetch.js";

/**
 * @param {Blob} chunk
 * @param {string} streamId
 * @param {string} [mimetype]
 */
export async function uploadStreamTranscribeChunk(chunk, streamId, mimetype) {
  const formData = new FormData();
  formData.append("streamId", streamId);
  const filename = mimetype?.includes("ogg") ? "chunk.ogg" : "chunk.webm";
  formData.append("audio", chunk, filename);

  try {
    const res = await authFetch("/api/interpreter/stream/transcribe/chunk", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || "request_failed",
        message: data.message,
        statusCode: res.status,
      };
    }
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * @param {{ language?: string }} [opts]
 */
export async function startStreamTranscribeSession(opts = {}) {
  try {
    const res = await authFetch("/api/interpreter/stream/transcribe/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: opts.language,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || "request_failed",
        message: data.message,
      };
    }
    return {
      ok: true,
      streamId: data.streamId,
      maxDurationMs: data.maxDurationMs,
      recommendedChunkMs: data.recommendedChunkMs,
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * @param {string} streamId
 */
export async function fetchStreamTranscribeStatus(streamId) {
  try {
    const res = await authFetch(
      `/api/interpreter/stream/transcribe/${encodeURIComponent(streamId)}/status`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || "request_failed" };
    }
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * @param {string} streamId
 * @param {string} [mimetype]
 */
export async function finishStreamTranscribeSession(streamId, mimetype) {
  try {
    const res = await authFetch(
      `/api/interpreter/stream/transcribe/${encodeURIComponent(streamId)}/finish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimetype: mimetype || "audio/webm" }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || "request_failed",
        message: data.message,
      };
    }
    return {
      ok: true,
      transcript: data.transcript,
      confidence: data.confidence,
      language: data.language,
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * @param {string} streamId
 */
export async function cancelStreamTranscribeSession(streamId) {
  try {
    await authFetch(
      `/api/interpreter/stream/transcribe/${encodeURIComponent(streamId)}`,
      { method: "DELETE" },
    );
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
