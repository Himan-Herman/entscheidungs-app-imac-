/**
 * Who is inside a real Pre-Visit context.
 *
 * ── Why this is its own module ──────────────────────────────────────────────
 * Two routes now need the same answer: the one that transcribes what a patient
 * said, and the one that reads a question back to them. The rule is a property
 * of the Pre-Visit flow, not of speech recognition, and having it written twice
 * would mean the day someone deactivates a QR target, one of the two copies
 * still honours it. So it lives once.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * EITHER an authenticated user, OR a QR token that resolves to an active target
 * of an active practice. Requiring a login instead would have been simpler and
 * wrong: the Pre-Visit preparation is deliberately usable without an account —
 * a practice hands out a QR code — so a login requirement deletes the flow
 * rather than securing it.
 *
 * This is proof of being inside a genuine Pre-Visit context. It is not proof of
 * identity and nothing here claims otherwise. What it replaces is "anyone at
 * all".
 *
 * ── Why the token is resolved against the database ──────────────────────────
 * A token a client presents is a claim. `PracticeQrTarget` is a row, and a
 * withdrawn target or a deactivated practice stops working the moment it is
 * switched off. That is what makes this authorization rather than a formality.
 *
 * This module never throws a feature's error type — each caller phrases the
 * refusal in its own vocabulary.
 */

import { prisma } from "../../lib/prisma.js";

/**
 * @param {{ userId?: unknown, qrToken?: unknown }} input
 * @returns {Promise<{ allowed: true, via: "account" | "qr", practiceProfileId?: string }
 *                  | { allowed: false }>}
 */
export async function resolvePreVisitParticipation(input) {
  // An authenticated user is already inside the product; the Pre-Visit flow is
  // theirs to use, and neither route creates anything needing narrower scoping.
  const userId = typeof input?.userId === "string" ? input.userId.trim() : "";
  if (userId) return { allowed: true, via: "account" };

  const qrToken = String(input?.qrToken ?? "").trim();
  if (!qrToken) return { allowed: false };

  const target = await prisma.practiceQrTarget.findUnique({
    where: { qrToken },
    select: {
      isActive: true,
      practiceProfileId: true,
      practiceProfile: { select: { isActive: true } },
    },
  });

  // An unknown token, a deactivated target and a deactivated practice all
  // answer identically: a caller learns nothing about which practices exist.
  if (!target?.isActive || !target.practiceProfile?.isActive) {
    return { allowed: false };
  }

  return { allowed: true, via: "qr", practiceProfileId: target.practiceProfileId };
}
