/**
 * Test-only hostile worker.
 *
 * Stands in for a parser that misbehaves in the two ways that matter, so the
 * isolation guarantees can be tested as behaviour rather than asserted in a
 * comment:
 *
 *   block  — a synchronous loop that never yields. This is the case an
 *            in-process Promise.race cannot survive, because the timer it
 *            depends on never gets to run.
 *   memory — allocation until the worker's own heap ceiling is hit.
 *   ok     — a normal, prompt reply, so the success path is covered too.
 *
 * Never imported by production code.
 */

import { parentPort, workerData } from "node:worker_threads";

const mode = workerData?.format;

if (mode === "block") {
  // Deliberately synchronous and unbounded: nothing in this thread will yield
  // again, so only terminate() can stop it.
  while (true) {
    // busy
  }
} else if (mode === "memory") {
  const hold = [];
  while (true) {
    hold.push(new Array(1_000_000).fill(Math.floor(hold.length % 7)));
  }
} else {
  parentPort?.postMessage({ ok: true, result: { echoed: mode } });
}
