import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "../../storage/user-avatars");

/**
 * Disk storage for patient profile pictures.
 * Mirrors PracticeLogoStorage: random UUID filenames namespaced per user, so no
 * original/unsafe filename is ever used and only the storage key lives in the DB.
 */
export class UserAvatarStorage {
  constructor(rootDir = process.env.USER_AVATAR_STORAGE_DIR || DEFAULT_ROOT) {
    this.rootDir = rootDir;
  }

  /**
   * @param {{ userId: string, buffer: Buffer, mimeType: string }} input
   * @returns {Promise<string>} storage key (relative, safe — never a public path)
   */
  async putAvatar(input) {
    const ext =
      input.mimeType === "image/png"
        ? "png"
        : input.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const storageKey = path.posix.join(
      input.userId,
      `${crypto.randomUUID()}.${ext}`,
    );
    const fullPath = path.join(this.rootDir, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /** @param {string} storageKey */
  async getAvatar(storageKey) {
    const fullPath = this.#resolveSafe(storageKey);
    return fs.readFile(fullPath);
  }

  /** @param {string | null | undefined} storageKey */
  async deleteAvatar(storageKey) {
    if (!storageKey) return;
    try {
      await fs.unlink(this.#resolveSafe(storageKey));
    } catch {
      /* already gone — non-fatal */
    }
  }

  /**
   * Resolve a storage key under the root and reject any path traversal.
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

export const userAvatarStorage = new UserAvatarStorage();
