import multer from "multer";

const MAX_BYTES = 2 * 1024 * 1024;

// SVG is intentionally excluded (no sanitizer in the project) — image raster only.
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export const uploadUserAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("avatar_type_invalid"));
    }
  },
});

export { ALLOWED_MIME as USER_AVATAR_MIME_TYPES, MAX_BYTES as USER_AVATAR_MAX_BYTES };
