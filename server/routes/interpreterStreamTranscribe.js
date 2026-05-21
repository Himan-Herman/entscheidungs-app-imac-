/**
 * Medical Interpreter — chunked streaming STT prototype (Phase 5.3).
 * POST /api/interpreter/stream/transcribe/*
 *
 * No WebSocket in repo — safe chunked upload + in-memory assembly.
 */

import express from "express";
import {
  isInterpreterStreamingSttEnabled,
  isMedicalInterpreterEnabled,
} from "../config/featureFlags.js";
import {
  interpreterStreamChunkLimiter,
  interpreterStreamSharedLimiter,
} from "../middleware/interpreterRateLimit.js";
import { uploadInterpreterAudio } from "../middleware/uploadInterpreterAudio.js";
import {
  appendStreamChunk,
  cancelStreamSession,
  finishStreamSession,
  getStreamStatus,
  startStreamSession,
} from "../services/interpreter/interpreterStreamTranscribeService.js";

const router = express.Router();

const DISABLED_BODY = {
  ok: false,
  error: "interpreter_streaming_disabled",
  message: "Streaming transcription is not available.",
};

const MODULE_DISABLED_BODY = {
  ok: false,
  error: "medical_interpreter_disabled",
  message: "Medical Interpreter is not available.",
};

function requireInterpreterEnabled(_req, res, next) {
  if (!isMedicalInterpreterEnabled()) {
    return res.status(503).json(MODULE_DISABLED_BODY);
  }
  return next();
}

function requireStreamingSttEnabled(_req, res, next) {
  if (!isInterpreterStreamingSttEnabled()) {
    return res.status(503).json(DISABLED_BODY);
  }
  return next();
}

function getUserId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function logStreamError(event, req) {
  const requestId =
    typeof req?.requestId === "string" ? req.requestId : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      event,
      requestId,
    }),
  );
}

router.use(requireInterpreterEnabled, requireStreamingSttEnabled);
router.use(interpreterStreamSharedLimiter);

/**
 * POST /api/interpreter/stream/transcribe/start
 * Body: { language?: string }
 */
router.post("/transcribe/start", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: "Authentication required.",
      });
    }
    const languageHint =
      req.body?.language != null ? String(req.body.language) : undefined;
    const result = startStreamSession(userId, { languageHint });
    return res.status(201).json(result);
  } catch (err) {
    logStreamError("interpreter_stream_start_error", req);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "Could not start streaming session.",
    });
  }
});

/**
 * POST /api/interpreter/stream/transcribe/chunk
 * multipart: streamId, audio (file)
 */
router.post(
  "/transcribe/chunk",
  interpreterStreamChunkLimiter,
  (req, res, next) => {
    uploadInterpreterAudio.single("audio")(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          error: "validation_file_too_large",
          message: "Audio chunk is too large.",
        });
      }
      return res.status(400).json({
        ok: false,
        error: "validation_invalid_audio",
        message: "Invalid audio chunk.",
      });
    });
  },
  async (req, res) => {
    let buffer = null;
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "unauthorized",
          message: "Authentication required.",
        });
      }
      const streamId = String(req.body?.streamId || "").trim();
      if (!streamId) {
        return res.status(400).json({
          ok: false,
          error: "stream_id_required",
          message: "Stream id is required.",
        });
      }
      buffer = req.file?.buffer;
      if (!buffer?.length) {
        return res.status(400).json({
          ok: false,
          error: "validation_missing_audio",
          message: "Audio chunk is required.",
        });
      }

      const result = await appendStreamChunk(
        userId,
        streamId,
        buffer,
        req.file?.mimetype,
      );
      return res.status(result.statusCode || (result.ok ? 200 : 400)).json(result);
    } catch (err) {
      logStreamError("interpreter_stream_chunk_error", req);
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not process audio chunk.",
      });
    } finally {
      if (buffer) {
        try {
          buffer.fill(0);
        } catch {
          /* ignore */
        }
      }
      if (req.file) req.file.buffer = null;
    }
  },
);

/**
 * GET /api/interpreter/stream/transcribe/:streamId/status
 */
router.get("/transcribe/:streamId/status", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: "Authentication required.",
      });
    }
    const streamId = String(req.params.streamId || "").trim();
    const result = getStreamStatus(userId, streamId);
    return res.status(result.statusCode || (result.ok ? 200 : 404)).json(result);
  } catch (err) {
    logStreamError("interpreter_stream_status_error", req);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "Could not read stream status.",
    });
  }
});

/**
 * POST /api/interpreter/stream/transcribe/:streamId/finish
 */
router.post("/transcribe/:streamId/finish", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: "Authentication required.",
      });
    }
    const streamId = String(req.params.streamId || "").trim();
    const mimetype =
      req.body?.mimetype != null ? String(req.body.mimetype) : "audio/webm";
    const result = await finishStreamSession(userId, streamId, mimetype);
    return res.status(result.statusCode || (result.ok ? 200 : 400)).json(result);
  } catch (err) {
    logStreamError("interpreter_stream_finish_error", req);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "Could not finalize transcript.",
    });
  }
});

/**
 * DELETE /api/interpreter/stream/transcribe/:streamId
 */
router.delete("/transcribe/:streamId", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: "Authentication required.",
      });
    }
    const streamId = String(req.params.streamId || "").trim();
    const result = cancelStreamSession(userId, streamId);
    return res.status(result.statusCode || (result.ok ? 200 : 404)).json(result);
  } catch (err) {
    logStreamError("interpreter_stream_cancel_error", req);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "Could not cancel stream.",
    });
  }
});

export default router;
