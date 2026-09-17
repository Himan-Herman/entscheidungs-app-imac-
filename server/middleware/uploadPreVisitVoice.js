/**
 * The Pre-Visit voice upload, bounded by its own limits.
 *
 * Replaces an inline multer with a ten-megabyte cap and a type list that
 * accepted formats nothing records. Memory storage on purpose: a recording that
 * is never written to disk cannot be left behind and needs no cleanup step to
 * be sure of.
 */

import multer from "multer";
import {
  MAX_PREVISIT_VOICE_BYTES,
  PREVISIT_VOICE_MIME,
} from "../services/preVisitVoice/preVisitVoicePolicy.js";

function fileFilter(req, file, cb) {
  const mime = String(file.mimetype || "").split(";")[0].trim().toLowerCase();
  // A first, cheap filter on the declared type. The real check looks at the
  // bytes, because a declared type is a claim.
  cb(null, PREVISIT_VOICE_MIME.includes(mime));
}

export const uploadPreVisitVoice = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PREVISIT_VOICE_BYTES, files: 1, fields: 4 },
  fileFilter,
});
