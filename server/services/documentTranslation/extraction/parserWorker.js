/**
 * Worker entry point for document parsing.
 *
 * Everything that hands attacker-controlled bytes to a third-party parser runs
 * here, in a thread with its own heap limit that the host can terminate. The
 * host keeps policy decisions; this thread does nothing but parse and hand back
 * plain data.
 *
 * Errors are posted as `{ code, detail }` rather than thrown across the thread
 * boundary: an Error subclass does not survive structured cloning with its
 * prototype, so a DocumentTranslationError would arrive as a plain object with
 * its identity lost. The host rehydrates it.
 */

import { parentPort, workerData } from "node:worker_threads";

import { parsePdfBuffer } from "./pdfTextExtractor.js";
import { parseDocxBuffer } from "./docxTextExtractor.js";
import { TRANSLATION_ERRORS } from "../documentTranslationPolicy.js";

const PARSERS = {
  pdf: parsePdfBuffer,
  docx: parseDocxBuffer,
};

async function run() {
  const { format, buffer } = workerData || {};
  const parse = PARSERS[format];

  if (!parse) {
    return { ok: false, code: TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE, detail: { format } };
  }

  try {
    const result = await parse(Buffer.from(buffer));
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      code: err?.code ?? TRANSLATION_ERRORS.CORRUPT,
      // Detail is metadata only by construction; document content never gets
      // into these objects, so nothing sensitive crosses the boundary.
      detail: err?.detail ?? { reason: "parse_failed" },
    };
  }
}

run().then(
  (payload) => parentPort?.postMessage(payload),
  () =>
    parentPort?.postMessage({
      ok: false,
      code: TRANSLATION_ERRORS.CORRUPT,
      detail: { reason: "worker_failed" },
    }),
);
