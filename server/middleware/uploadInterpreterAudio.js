import multer from "multer";
import {
  INTERPRETER_ALLOWED_AUDIO_MIMES,
  INTERPRETER_MAX_AUDIO_BYTES,
} from "../config/interpreterEnv.js";
import { sanitizeUploadFilename } from "../services/interpreter/interpreterInputSafety.js";

const storage = multer.memoryStorage();

export const uploadInterpreterAudio = multer({
  storage,
  limits: {
    fileSize: INTERPRETER_MAX_AUDIO_BYTES,
    files: 1,
    fields: 4,
    fieldNameSize: 32,
    fieldSize: 64,
  },
  fileFilter(_req, file, cb) {
    const mime = file.mimetype && String(file.mimetype).trim().toLowerCase();
    if (mime && INTERPRETER_ALLOWED_AUDIO_MIMES.has(mime)) {
      if (file.originalname) {
        file.originalname = sanitizeUploadFilename(file.originalname);
      }
      cb(null, true);
      return;
    }
    const err = new Error("UNSUPPORTED_AUDIO_TYPE");
    err.code = "UNSUPPORTED_AUDIO_TYPE";
    cb(err);
  },
});
