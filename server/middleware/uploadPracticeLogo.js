import multer from "multer";

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export const uploadPracticeLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("logo_type_invalid"));
    }
  },
});

export { ALLOWED_MIME as PRACTICE_LOGO_MIME_TYPES, MAX_BYTES as PRACTICE_LOGO_MAX_BYTES };
