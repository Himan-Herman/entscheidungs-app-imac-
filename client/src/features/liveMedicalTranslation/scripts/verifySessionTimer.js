import { computeActiveSessionElapsedMs } from "../utils/sessionTimer.js";

const failures = [];

function assert(name, condition) {
  if (!condition) failures.push(name);
}

const t0 = 1_000_000;
let accumulated = 0;
let runningSince = t0;

assert("running elapsed", computeActiveSessionElapsedMs(accumulated, runningSince, t0 + 5000) === 5000);

accumulated = 5000;
runningSince = null;
assert("paused elapsed frozen", computeActiveSessionElapsedMs(accumulated, runningSince, t0 + 120_000) === 5000);

runningSince = t0 + 120_000;
assert(
  "resumed elapsed continues",
  computeActiveSessionElapsedMs(accumulated, runningSince, t0 + 125_000) === 10_000,
);

if (failures.length) {
  console.error("verifySessionTimer FAILED:", failures);
  process.exit(1);
}

console.log("verifySessionTimer OK");
