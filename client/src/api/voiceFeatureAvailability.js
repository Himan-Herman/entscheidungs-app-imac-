/**
 * Whether a voice feature is switched on in this deployment.
 *
 * Asked once and remembered: the answer is a deployment property, not a
 * per-user one, and re-asking on every render would put a request behind every
 * page that offers a microphone.
 *
 * Why ask at all: a control that fails when pressed looks exactly like a
 * defect. Knowing the feature is off lets the interface say so instead of
 * offering something that cannot work.
 *
 * A failure to reach the endpoint is treated as "available". The server refuses
 * regardless, so the worst case is a control that reports an honest error —
 * whereas hiding the microphone because a health check hiccuped would remove a
 * working feature.
 */

let cached = null;

/** The snapshot, fetched at most once. */
async function features() {
  if (cached !== null) return cached;
  try {
    const res = await fetch("/api/health/config");
    const data = await res.json();
    cached = data?.features ?? {};
  } catch {
    cached = {};
  }
  return cached;
}

/**
 * Each feature is asked about separately.
 *
 * They have separate gates on the server for good reasons, and a client that
 * collapsed them into one "voice available" answer would hide a deployment
 * where one is on and the other is not.
 */
export async function isSymptomVoiceInputAvailable() {
  return (await features()).symptomVoiceInput !== false;
}

export async function isPreVisitVoiceInputAvailable() {
  return (await features()).preVisitVoiceInput !== false;
}

export async function isSymptomVoiceOutputAvailable() {
  return (await features()).symptomVoiceOutput !== false;
}

export async function isPreVisitVoiceOutputAvailable() {
  return (await features()).preVisitVoiceOutput !== false;
}

/** Test seam: forget the remembered answer. */
export function resetVoiceFeatureAvailability() {
  cached = null;
}
