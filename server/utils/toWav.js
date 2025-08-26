import fs from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath);

export async function bufferToWav(buffer, inExt = ".webm") {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "medscout-"));
  const inPath = path.join(tmpDir, `in${inExt}`);
  const outPath = path.join(tmpDir, `out.wav`);
  fs.writeFileSync(inPath, buffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .outputOptions([
        "-acodec pcm_s16le", // PCM 16-bit
        "-ac 1",             // 1 Kanal
        "-ar 16000",         // 16 kHz (Azure ok)
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outPath);
  });

  const wav = fs.readFileSync(outPath);
  // aufräumen (nicht kritisch, aber sauber)
  try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); fs.rmdirSync(tmpDir); } catch {}
  return wav;
}
