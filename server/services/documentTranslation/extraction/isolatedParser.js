/**
 * Terminable, memory-bounded isolation for document parsing.
 *
 * ── Why a worker and not a timeout ──────────────────────────────────────────
 * Phase 2A.1 bounded parsing with `Promise.race` against a timer. That only
 * works while the parser keeps yielding to the event loop: a synchronous hot
 * loop inside pdf.js blocks the loop, and the timer that was supposed to stop
 * it never fires. Memory was not bounded at all — a parser that allocates
 * without limit takes the whole server process down with it.
 *
 * Running the parse in a worker fixes both. `resourceLimits` gives the thread
 * its own heap ceiling, and `terminate()` stops it whether or not it is
 * cooperating. The request fails; the server keeps serving.
 *
 * ── What stays in the host ──────────────────────────────────────────────────
 * Byte-level preflight runs BEFORE a worker is started: it is cheap, needs no
 * parser, and rejecting an obvious bomb should not cost a thread spawn. Policy
 * decisions — plausibility floors, structure rules, type allowlist — also stay
 * in the host. The worker only parses.
 */

import { Worker } from "node:worker_threads";
import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "../documentTranslationPolicy.js";

const WORKER_URL = new URL("./parserWorker.js", import.meta.url);

export const ISOLATION_LIMITS = Object.freeze({
  /**
   * Hard wall-clock ceiling. Unlike an in-process race this is enforced by
   * terminating the thread, so it holds even if the parser never yields.
   */
  TIMEOUT_MS: 20_000,
  /**
   * Heap ceiling for the parse. Generous enough for a 25 MB document with a
   * large object graph, far below anything that would threaten the host.
   */
  MAX_OLD_GENERATION_MB: 256,
  MAX_YOUNG_GENERATION_MB: 32,
  STACK_SIZE_MB: 4,
});

/**
 * Parse a document in an isolated worker.
 *
 * @param {"pdf"|"docx"} format
 * @param {Buffer} buffer
 * @param {{ timeoutMs?: number, workerUrl?: URL }} [options]
 *   `timeoutMs` lets a caller tighten (never silently loosen) the ceiling;
 *   `workerUrl` exists so the isolation guarantees themselves — that a blocked
 *   thread is really terminated and a runaway allocation really trips the heap
 *   limit — can be tested against a deliberately hostile worker. Neither is
 *   used by production callers.
 * @returns {Promise<object>} the parser's plain-data result
 * @throws {DocumentTranslationError}
 */
export function parseInIsolation(format, buffer, options = {}) {
  const timeoutMs = Math.min(
    Number(options.timeoutMs) || ISOLATION_LIMITS.TIMEOUT_MS,
    ISOLATION_LIMITS.TIMEOUT_MS,
  );
  const workerUrl = options.workerUrl ?? WORKER_URL;

  return new Promise((resolve, reject) => {
    let worker;
    let settled = false;
    let timer;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Always tear the thread down: a worker that resolved late, errored, or
      // is still spinning must not outlive the request that started it.
      worker?.terminate().catch(() => {});
      fn(value);
    };

    try {
      worker = new Worker(workerUrl, {
        workerData: { format, buffer },
        resourceLimits: {
          maxOldGenerationSizeMb: ISOLATION_LIMITS.MAX_OLD_GENERATION_MB,
          maxYoungGenerationSizeMb: ISOLATION_LIMITS.MAX_YOUNG_GENERATION_MB,
          stackSizeMb: ISOLATION_LIMITS.STACK_SIZE_MB,
        },
      });
    } catch {
      reject(
        new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, {
          reason: "worker_start_failed",
        }),
      );
      return;
    }

    timer = setTimeout(() => {
      finish(
        reject,
        new DocumentTranslationError(TRANSLATION_ERRORS.TOO_LARGE, {
          reason: "parse_timeout",
          ms: timeoutMs,
        }),
      );
    }, timeoutMs);
    // Do not hold the process open for the sake of this timer.
    timer.unref?.();

    worker.on("message", (payload) => {
      if (payload?.ok) {
        finish(resolve, payload.result);
        return;
      }
      finish(
        reject,
        new DocumentTranslationError(
          payload?.code ?? TRANSLATION_ERRORS.CORRUPT,
          payload?.detail ?? { reason: "parse_failed" },
        ),
      );
    });

    worker.on("error", (err) => {
      // ERR_WORKER_OUT_OF_MEMORY arrives here when resourceLimits is breached.
      const outOfMemory = String(err?.code ?? "") === "ERR_WORKER_OUT_OF_MEMORY";
      finish(
        reject,
        new DocumentTranslationError(
          outOfMemory ? TRANSLATION_ERRORS.TOO_LARGE : TRANSLATION_ERRORS.CORRUPT,
          { reason: outOfMemory ? "parse_out_of_memory" : "worker_error" },
        ),
      );
    });

    worker.on("exit", (code) => {
      // A worker that exits without having posted anything failed in a way we
      // cannot attribute. Fail closed rather than treat silence as success.
      finish(
        reject,
        new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, {
          reason: "worker_exited",
          exitCode: code,
        }),
      );
    });
  });
}
