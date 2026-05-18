import multer from "multer";

const MAX_BYTES = 25 * 1024 * 1024;

export const uploadPracticeDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});
