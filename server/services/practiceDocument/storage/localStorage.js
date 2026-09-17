import { STORAGE_AREAS, storageAreaRoot } from "../../../config/storageRoot.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";


/**
 * Local filesystem storage for development / single-node deploy.
 * Production: replace with object storage implementing the same interface.
 */
export class LocalPracticeDocumentStorage {
  constructor(rootDir = storageAreaRoot(STORAGE_AREAS.PRACTICE_DOCUMENTS, process.env.PRACTICE_DOCUMENT_STORAGE_DIR)) {
    this.rootDir = rootDir;
  }

  /**
   * @param {{ practiceProfileId: string, documentId: string, buffer: Buffer, originalFileName: string }} input
   */
  async putObject(input) {
    const safeName = String(input.originalFileName || "file")
      .replace(/[^\w.\-()+ ]/g, "_")
      .slice(0, 180);
    const storageKey = path.posix.join(
      input.practiceProfileId,
      input.documentId,
      `${crypto.randomUUID()}_${safeName}`,
    );
    const fullPath = this.#resolveSafe(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /**
   * @param {string} storageKey
   */
  async getObject(storageKey) {
    const fullPath = this.#resolveSafe(storageKey);
    const buffer = await fs.readFile(fullPath);
    return buffer;
  }

  /**
   * @param {string} storageKey
   */
  async deleteObject(storageKey) {
    try {
      const fullPath = this.#resolveSafe(storageKey);
      await fs.unlink(fullPath);
    } catch {
      /* ignore missing */
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
