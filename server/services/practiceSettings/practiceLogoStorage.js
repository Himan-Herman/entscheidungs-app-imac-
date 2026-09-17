import { STORAGE_AREAS, storageAreaRoot } from "../../config/storageRoot.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";


export class PracticeLogoStorage {
  constructor(rootDir = storageAreaRoot(STORAGE_AREAS.PRACTICE_LOGOS, process.env.PRACTICE_LOGO_STORAGE_DIR)) {
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
    const fullPath = this.#resolveSafe(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /** @param {string} storageKey */
  async getLogo(storageKey) {
    const fullPath = this.#resolveSafe(storageKey);
    return fs.readFile(fullPath);
  }

  /** @param {string | null | undefined} storageKey */
  async deleteLogo(storageKey) {
    if (!storageKey) return;
    try {
      await fs.unlink(this.#resolveSafe(storageKey));
    } catch {
      /* ignore */
    }
  }

  /**
   * Resolves a key under this service's root and refuses anything that climbs
   * out of it.
   *
   * Every key here is generated server-side, so this should never fire. It is
   * the last place a key becomes a filesystem path, and a check that costs one
   * comparison is worth more than the argument that it cannot happen.
   *
   * @param {string} storageKey
   */
  #resolveSafe(storageKey) {
    const fullPath = path.resolve(this.rootDir, storageKey);
    const root = path.resolve(this.rootDir);
    if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
      throw new Error("invalid_storage_key");
    }
    return fullPath;
  }

}

export const practiceLogoStorage = new PracticeLogoStorage();
