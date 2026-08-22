/**
 * Who may have a Pre-Visit recording transcribed.
 *
 * The rule itself — authenticated user OR active QR target of an active
 * practice — lives in `preVisitAccess/preVisitParticipation.js`, because the
 * read-aloud route needs the same answer and two copies would drift. This file
 * is only the translation of that answer into this feature's error vocabulary.
 *
 * Before this was built the route sat on a mount without `requireAuth`, so
 * anyone who could reach the server could send audio onwards at the
 * deployment's expense.
 */

import { resolvePreVisitParticipation } from "../preVisitAccess/preVisitParticipation.js";
import { PREVISIT_VOICE_ERRORS, PreVisitVoiceError } from "./preVisitVoicePolicy.js";

/**
 * @param {{ userId?: string | null, qrToken?: unknown }} input
 * @returns {Promise<{ via: "account" | "qr", practiceProfileId?: string }>}
 * @throws {PreVisitVoiceError} not_authorized
 */
export async function assertPreVisitVoiceAllowed(input) {
  const participation = await resolvePreVisitParticipation(input);
  if (!participation.allowed) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.NOT_AUTHORIZED);
  }
  return {
    via: participation.via,
    ...(participation.practiceProfileId
      ? { practiceProfileId: participation.practiceProfileId }
      : {}),
  };
}
