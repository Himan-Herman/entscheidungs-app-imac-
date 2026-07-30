/**
 * Transactional outbox for lifecycle receipt e-mails.
 *
 * Guarantees:
 * - enqueue runs in the SAME transaction as the state change it confirms:
 *   a rolled-back deletion can never produce a confirmation e-mail, and a
 *   committed change can never lose its receipt (the row persists until sent).
 * - sending happens strictly AFTER commit and outside any DB transaction, so
 *   a slow mail provider can never hold a database transaction open.
 * - a pending→sending claim (guarded updateMany) prevents double sends when
 *   two dispatchers overlap; failures return to "failed" and are retried by
 *   the next dispatch run until MAX_ATTEMPTS.
 *
 * Opening a mail client or returning an API response is NEVER treated as
 * delivery; only a successful provider send marks the row "sent".
 */
import { prisma } from "../../lib/prisma.js";
import { sendMail } from "../../emailService.js";
import { getSupportEmail } from "../../config/supportContact.js";
import { renderLifecycleEmail, normalizeLifecycleLocale } from "./lifecycleEmailTemplates.js";

const MAX_ATTEMPTS = 5;

/**
 * Writes one outbox row inside the caller's transaction.
 * `params` must contain template parameters only — never medical data.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ caseNumber: string, kind: string, recipientEmail: string,
 *           locale?: string, params?: Record<string, string> }} args
 */
export async function enqueueLifecycleEmail(tx, { caseNumber, kind, recipientEmail, locale, params }) {
  if (!recipientEmail) return null;
  return tx.lifecycleOutboxEmail.create({
    data: {
      caseNumber,
      kind,
      recipientEmail,
      locale: normalizeLifecycleLocale(locale),
      paramsJson: params ? JSON.stringify(params) : null,
    },
  });
}

/**
 * Convenience: owner/patient receipt + internal MedScoutX notice in one call.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function enqueueLifecycleReceiptPair(tx, {
  caseNumber, kind, recipientEmail, locale, params, internalStatus,
}) {
  await enqueueLifecycleEmail(tx, { caseNumber, kind, recipientEmail, locale, params });
  await enqueueLifecycleEmail(tx, {
    caseNumber,
    kind: "medscoutx_internal_notice",
    recipientEmail: getSupportEmail(),
    locale: "de",
    params: {
      ...params,
      internalAction: kind,
      internalStatus: internalStatus || "",
    },
  });
}

function safeParams(row) {
  try {
    const parsed = row.paramsJson ? JSON.parse(row.paramsJson) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Sends pending/failed rows. Call after commit (fire-and-forget via
 * kickLifecycleOutbox) or from a worker/internal sweep.
 * @param {{ limit?: number, sendFn?: typeof sendMail }} [opts] sendFn is a
 *   test seam only — production always uses the Resend-backed sendMail.
 * @returns {Promise<{ sent: number, failed: number, skipped: number }>}
 */
export async function dispatchPendingLifecycleEmails({ limit = 25, sendFn = sendMail } = {}) {
  const stats = { sent: 0, failed: 0, skipped: 0 };
  const candidates = await prisma.lifecycleOutboxEmail.findMany({
    where: { status: { in: ["pending", "failed"] }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of candidates) {
    // Claim: only one dispatcher may move the row pending/failed → sending.
    const claimed = await prisma.lifecycleOutboxEmail.updateMany({
      where: { id: row.id, status: { in: ["pending", "failed"] } },
      data: { status: "sending", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      stats.skipped += 1;
      continue;
    }

    const rendered = renderLifecycleEmail(row.kind, row.locale, {
      supportEmail: getSupportEmail(),
      recipientEmail: row.recipientEmail,
      caseNumber: row.caseNumber,
      ...safeParams(row),
    });

    if (!rendered) {
      await prisma.lifecycleOutboxEmail.updateMany({
        where: { id: row.id },
        data: { status: "failed", lastError: "no_template" },
      });
      stats.failed += 1;
      continue;
    }

    try {
      await sendFn(row.recipientEmail, rendered.subject, rendered.text, undefined, {
        replyTo: getSupportEmail(),
      });
      await prisma.lifecycleOutboxEmail.updateMany({
        where: { id: row.id },
        data: { status: "sent", sentAt: new Date(), lastError: null },
      });
      stats.sent += 1;
    } catch (err) {
      // Row survives for the next dispatch run — the receipt is not lost.
      await prisma.lifecycleOutboxEmail.updateMany({
        where: { id: row.id },
        data: { status: "failed", lastError: String(err?.message || "send_failed").slice(0, 300) },
      });
      stats.failed += 1;
    }
  }
  return stats;
}

/** Fire-and-forget post-commit kick. Never throws into the request path. */
export function kickLifecycleOutbox() {
  void dispatchPendingLifecycleEmails().catch((err) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "lifecycle_outbox_dispatch_failed",
        message: String(err?.message || err).slice(0, 200),
      }),
    );
  });
}
