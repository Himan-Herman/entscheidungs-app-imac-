import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "../../../storage/practice-documents");

/**
 * Local filesystem storage for development / single-node deploy.
 * Production: replace with object storage implementing the same interface.
 */
export class LocalPracticeDocumentStorage {
  constructor(rootDir = process.env.PRACTICE_DOCUMENT_STORAGE_DIR || DEFAULT_ROOT) {
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
    const fullPath = path.join(this.rootDir, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /**
   * @param {string} storageKey
   */
  async getObject(storageKey) {
    const fullPath = path.join(this.rootDir, storageKey);
    const buffer = await fs.readFile(fullPath);
    return buffer;
  }

  /**
   * @param {string} storageKey
   */
  async deleteObject(storageKey) {
    try {
      const fullPath = path.join(this.rootDir, storageKey);
      await fs.unlink(fullPath);
    } catch {
      /* ignore missing */
    }
  }
}
