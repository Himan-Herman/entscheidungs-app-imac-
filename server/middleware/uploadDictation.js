/**
 * The dictation upload, bounded by its own limits.
 *
 * Deliberately not the shared `uploadAudio`: that one exists for a different
 * feature, allows ten megabytes and a wider set of types, and changing it would
 * change that feature too. A dictation is ninety seconds of speech, and the
 * limits here say so.
 *
 * Memory storage on purpose. A recording that is never written to disk cannot
 * be left behind by a crash, cannot be served by a misconfigured static route,
 * and needs no cleanup step to be sure of — the absence of a file is a stronger
 * guarantee than deleting one. The size limit is what makes that safe: four
 * megabytes cannot exhaust memory, and multer refuses anything larger before
 * it is buffered.
 */

import multer from "multer";
import {
  ALLOWED_AUDIO_MIME,
  MAX_DICTATION_BYTES,
} from "../services/messageSpeech/messageSttPolicy.js";

/**
 * A first, cheap filter on the declared type.
 *
 * The real check is in the policy, which also looks at the bytes — a declared
 * MIME type is a claim, and this only stops the obviously wrong ones from being
 * buffered at all.
 */
function fileFilter(req, file, cb) {
  const mime = String(file.mimetype || "").split(";")[0].trim().toLowerCase();
  cb(null, ALLOWED_AUDIO_MIME.includes(mime));
}

export const uploadDictation = multer({
  storage: multer.memoryStorage(),
  // One file, one field. Nothing else may accompany a recording.
  limits: { fileSize: MAX_DICTATION_BYTES, files: 1, fields: 4 },
  fileFilter,
});
