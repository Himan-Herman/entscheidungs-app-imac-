/**
 * Where a patient's vaccination certificate is actually kept.
 *
 * ── Why this file exists at all ─────────────────────────────────────────────
 * It did not, and that was the defect. The upload route accepted the file,
 * wrote three columns describing it, and dropped the buffer on the floor.
 * `hasDocument` then reported `true` to the patient AND to their practice for a
 * document that had never been anywhere — and no route existed that could have
 * fetched one. A patient who photographed their vaccination card and pressed
 * save was told it was attached.
 *
 * ── Not a new mechanism ─────────────────────────────────────────────────────
 * A vaccination certificate belongs to one patient, is named by a
 * server-generated key, and is never addressed by anything the uploader chose —
 * so it is namespaced by user, like an avatar, rather than by practice, like a
 * practice document. A vaccination entry belongs to the patient, not to
 * whichever practice happens to be looking at it.
 *
 * WHERE it is written is not this file's decision. All five file stores resolve
 * a named subdirectory of one root — see config/storageRoot.js — so a single
 * mounted disk covers every one of them and none can end up on the ephemeral
 * checkout while the others are safe.
 *
 * ── The key ─────────────────────────────────────────────────────────────────
 * `v2/<userId>/<uuid>.<ext>`. Two parts of that matter:
 *
 *   - Nothing the uploader supplied appears in it. The original filename is
 *     kept separately, for display, and is never a path.
 *   - The `v2/` prefix separates keys that have a file behind them from the
 *     ones written before this existed. Those old rows name a file that was
 *     never written, and telling the two apart is what lets `hasDocument`
 *     stop lying about them without a migration.
 */
import { STORAGE_AREAS, storageAreaRoot } from "../../config/storageRoot.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";


/**
 * Keys written by this module. Anything else in `documentKey` predates it and
 * has no file behind it.
 */
export const VACCINATION_KEY_PREFIX = "v2/";

/** The types a vaccination certificate may be — a photo of a card, or a PDF. */
export const VACCINATION_DOCUMENT_MIME = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Matches the client-side limit shown to the patient ("max. 10 MB"). */
export const VACCINATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
});

/**
 * Does this key name a file this module actually wrote?
 *
 * The question a response has to answer before it claims a document exists.
 *
 * @param {unknown} storageKey
 * @returns {boolean}
 */
export function isStoredVaccinationKey(storageKey) {
  return typeof storageKey === "string" && storageKey.startsWith(VACCINATION_KEY_PREFIX);
}

export class VaccinationDocumentStorage {
  /** @param {string} [rootDir] */
  constructor(rootDir = storageAreaRoot(STORAGE_AREAS.VACCINATION_DOCUMENTS, process.env.VACCINATION_DOCUMENT_STORAGE_DIR)) {
    this.rootDir = rootDir;
  }

  /**
   * Writes the file and returns the key to record.
   *
   * The caller records the key only after this resolves, so a storage failure
   * cannot leave a row claiming a document that is not there.
   *
   * @param {{ userId: string, buffer: Buffer, mimeType: string }} input
   * @returns {Promise<string>} the storage key — relative, and never a public path
   */
  async putDocument(input) {
    const ext = EXTENSIONS[input.mimeType] ?? "bin";
    const storageKey = path.posix.join(
      VACCINATION_KEY_PREFIX.replace(/\/$/, ""),
      input.userId,
      `${crypto.randomUUID()}.${ext}`,
    );
    const fullPath = this.#resolveSafe(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return storageKey;
  }

  /**
   * @param {string} storageKey
   * @returns {Promise<Buffer>}
   * @throws when the key is not one of ours, or the file is gone
   */
  async getDocument(storageKey) {
    if (!isStoredVaccinationKey(storageKey)) throw new Error("document_not_stored");
    return fs.readFile(this.#resolveSafe(storageKey));
  }

  /**
   * True when the key names a file that is really on disk.
   *
   * Used by the cleanup path after a failed write, and by the tests. It is
   * deliberately NOT used to build list responses: one `stat` per row per page
   * load is a cost the correctness does not need, because a key is only ever
   * recorded after the write succeeded.
   *
   * @param {string | null | undefined} storageKey
   */
  async exists(storageKey) {
    if (!isStoredVaccinationKey(storageKey)) return false;
    try {
      await fs.access(this.#resolveSafe(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Removes the file, if it is there. Missing is not an error: the point of
   * calling this is that the file should be gone afterwards.
   *
   * @param {string | null | undefined} storageKey
   */
  async deleteDocument(storageKey) {
    if (!isStoredVaccinationKey(storageKey)) return;
    try {
      await fs.unlink(this.#resolveSafe(storageKey));
    } catch {
      /* already gone — non-fatal */
    }
  }

  /**
   * Resolves a key under the root and refuses anything that climbs out of it.
   *
   * Keys are generated here and should never be hostile, but this is the last
   * place a bad one could turn into a filesystem path, so it is checked here
   * rather than assumed upstream.
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

export const vaccinationDocumentStorage = new VaccinationDocumentStorage();
