import { STORAGE_AREAS, storageAreaRoot } from "../../config/storageRoot.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";


export class LocalExportStorage {
  constructor(rootDir = storageAreaRoot(STORAGE_AREAS.EXPORTS, process.env.EXPORT_STORAGE_DIR)) {
    this.rootDir = rootDir;
  }

  /**
   * @param {{ exportJobId: string, buffer: Buffer, extension: string }} input
   */
  async putExportFile(input) {
    const ext = String(input.extension || "bin").replace(/^\./, "");
    const storageKey = path.posix.join(input.exportJobId, `${crypto.randomUUID()}.${ext}`);
    const fullPath = this.#resolveSafe(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /**
   * @param {string} storageKey
   */
  async getExportFile(storageKey) {
    const fullPath = this.#resolveSafe(storageKey);
    return fs.readFile(fullPath);
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

export const exportStorage = new LocalExportStorage();
