/**
 * The symptom voice upload, bounded by its own limits.
 *
 * Deliberately not the shared `uploadAudio`: that one allows ten megabytes and
 * a wider set of types, and it is still used by other features whose bounds are
 * not this feature's to change.
 *
 * Memory storage on purpose. A recording that is never written to disk cannot
 * be left behind, cannot be served by a misconfigured static route, and needs
 * no cleanup step to be sure of. The size limit is what makes that safe.
 */

import multer from "multer";
import {
  MAX_SYMPTOM_VOICE_BYTES,
  SYMPTOM_VOICE_MIME,
} from "../services/symptomVoice/symptomVoicePolicy.js";

function fileFilter(req, file, cb) {
  const mime = String(file.mimetype || "").split(";")[0].trim().toLowerCase();
  // A first, cheap filter on the declared type. The real check looks at the
  // bytes, because a declared type is a claim.
  cb(null, SYMPTOM_VOICE_MIME.includes(mime));
}

export const uploadSymptomVoice = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SYMPTOM_VOICE_BYTES, files: 1, fields: 4 },
  fileFilter,
});
