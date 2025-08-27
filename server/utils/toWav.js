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
        "-acodec pcm_s16le", 
        "-ac 1",            
        "-ar 16000",        
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outPath);
  });

  const wav = fs.readFileSync(outPath);
  
  try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); fs.rmdirSync(tmpDir); } catch {}
  return wav;
}
