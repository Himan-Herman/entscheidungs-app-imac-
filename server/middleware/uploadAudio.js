import multer from "multer";


const storage = multer.memoryStorage();


const allowedTypes = [
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",   // mp3
  "audio/ogg",    // ogg/opus
];

function fileFilter(req, file, cb) {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("❌ Ungültiger Dateityp. Erlaubt: webm, wav, m4a, mp4"));
  }
}

export const uploadAudio = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});
