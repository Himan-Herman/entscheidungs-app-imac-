import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "../../storage/exports");

export class LocalExportStorage {
  constructor(rootDir = process.env.EXPORT_STORAGE_DIR || DEFAULT_ROOT) {
    this.rootDir = rootDir;
  }

  /**
   * @param {{ exportJobId: string, buffer: Buffer, extension: string }} input
   */
  async putExportFile(input) {
    const ext = String(input.extension || "bin").replace(/^\./, "");
    const storageKey = path.posix.join(input.exportJobId, `${crypto.randomUUID()}.${ext}`);
    const fullPath = path.join(this.rootDir, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /**
   * @param {string} storageKey
   */
  async getExportFile(storageKey) {
    const fullPath = path.join(this.rootDir, storageKey);
    return fs.readFile(fullPath);
  }
}

export const exportStorage = new LocalExportStorage();
