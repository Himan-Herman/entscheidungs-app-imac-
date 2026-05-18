import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "../../storage/practice-logos");

export class PracticeLogoStorage {
  constructor(rootDir = process.env.PRACTICE_LOGO_STORAGE_DIR || DEFAULT_ROOT) {
    this.rootDir = rootDir;
  }

  /**
   * @param {{ practiceProfileId: string, buffer: Buffer, mimeType: string }} input
   */
  async putLogo(input) {
    const ext =
      input.mimeType === "image/png"
        ? "png"
        : input.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const storageKey = path.posix.join(
      input.practiceProfileId,
      `${crypto.randomUUID()}.${ext}`,
    );
    const fullPath = path.join(this.rootDir, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /** @param {string} storageKey */
  async getLogo(storageKey) {
    const fullPath = path.join(this.rootDir, storageKey);
    return fs.readFile(fullPath);
  }

  /** @param {string | null | undefined} storageKey */
  async deleteLogo(storageKey) {
    if (!storageKey) return;
    try {
      await fs.unlink(path.join(this.rootDir, storageKey));
    } catch {
      /* ignore */
    }
  }
}

export const practiceLogoStorage = new PracticeLogoStorage();
