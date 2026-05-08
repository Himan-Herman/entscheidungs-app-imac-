/**
 * Privacy-preserving analytics — no medical text, transcripts, PDF payloads, or raw identities.
 * Uses HMAC-SHA256 with server pepper; optional env ANALYTICS_HASH_PEPPER in production.
 *
 * Retention: TODO — periodically aggregate and delete raw AnalyticsEvent rows older than N days.
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PEPPER =
  typeof process.env.ANALYTICS_HASH_PEPPER === "string" &&
  process.env.ANALYTICS_HASH_PEPPER.length >= 16
    ? process.env.ANALYTICS_HASH_PEPPER
    : "dev-analytics-pepper-set-ANALYTICS_HASH_PEPPER";

/** Event names we persist (reject unknown types). */
export const ANALYTICS_EVENT_TYPES = new Set([
  "previsit_started",
  "previsit_language_selected",
  "previsit_adaptive_category_started",
  "previsit_adaptive_category_completed",
  "previsit_review_opened",
  "previsit_doctor_version_created",
  "previsit_pdf_created",
  "previsit_pdf_downloaded",
  "previsit_pdf_sent",
  "previsit_saved_to_account",
  "previsit_deleted",
  "qr_landing_opened",
  "qr_previsit_started",
  "practice_profile_created",
  "qr_target_created",
  "practice_dashboard_opened",
  "language_pair_used",
  "ui_language_changed",
  "speech_input_used",
  "text_to_speech_used",
  "followup_created",
  "followup_answered",
  "case_created",
  "case_followup_created",
]);

/** Client-facing POST /analytics/event allowlist (subset). */
export const ANALYTICS_CLIENT_EVENT_TYPES = new Set([
  "previsit_adaptive_category_started",
  "previsit_adaptive_category_completed",
  "previsit_review_opened",
  "previsit_language_selected",
  "previsit_saved_to_account",
  "practice_dashboard_opened",
  "ui_language_changed",
  "speech_input_used",
  "text_to_speech_used",
  "language_pair_used",
]);

const ALLOWED_METADATA_KEYS = new Set([
  "uiLanguage",
  "patientLanguage",
  "doctorLanguage",
  "source",
  "deviceType",
  "flowStep",
  "status",
  "targetType",
  "hasPracticeContext",
  "pdfCreated",
  "emailSent",
  "usedSpeechInput",
  "usedTextToSpeech",
  "adaptiveCategoryKey",
  "followupCount",
  "sessionDurationBucket",
  "completed",
  "abandoned",
  "errorRepeatCount",
  "hasCaseContext",
]);

export function hashAnalyticsId(value) {
  if (value === undefined || value === null || value === "") return null;
  return crypto.createHmac("sha256", PEPPER).update(String(value), "utf8").digest("hex");
}

function sanitizeScalarForKey(key, v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (key === "followupCount" || key === "errorRepeatCount") {
      const n = Math.floor(v);
      if (n < 0 || n > 50000) return null;
      return n;
    }
    return null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 64);
  if (!s) return null;

  if (key === "uiLanguage" || key === "patientLanguage" || key === "doctorLanguage") {
    if (!/^[a-z]{2}(-[a-z0-9]{2,8})?$/i.test(s)) return null;
    return s.toLowerCase();
  }
  if (key === "source") {
    if (s === "qr" || s === "manual" || s === "account") return s;
    return null;
  }
  if (key === "deviceType") {
    if (s === "mobile" || s === "tablet" || s === "desktop") return s;
    return null;
  }
  if (
    key === "flowStep" ||
    key === "status" ||
    key === "targetType" ||
    key === "adaptiveCategoryKey" ||
    key === "sessionDurationBucket"
  ) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(s)) return null;
    return s;
  }
  return null;
}

/**
 * Allowlisted metadata only; strips unknown keys and anything resembling identifiers/clinical text carriers.
 */
export function sanitizeAnalyticsMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const out = {};
  for (const [rawKey, rawVal] of Object.entries(metadata)) {
    if (typeof rawKey !== "string") continue;
    if (!ALLOWED_METADATA_KEYS.has(rawKey)) continue;
    out[rawKey] = sanitizeScalarForKey(rawKey, rawVal);
  }
  const cleaned = Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== null && v !== undefined),
  );
  return Object.keys(cleaned).length ? cleaned : null;
}

export async function trackAnalyticsEvent({
  eventType,
  userId,
  practiceId,
  sessionId,
  metadata,
}) {
  try {
    if (!eventType || typeof eventType !== "string" || !ANALYTICS_EVENT_TYPES.has(eventType)) {
      return;
    }
    const meta = sanitizeAnalyticsMetadata(metadata);
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        userHash: hashAnalyticsId(userId),
        practiceHash: practiceId ? hashAnalyticsId(practiceId) : null,
        sessionHash: sessionId ? hashAnalyticsId(sessionId) : null,
        metadata: meta === null ? undefined : meta,
      },
    });
  } catch (err) {
    console.warn("[analytics] trackAnalyticsEvent failed", eventType, err?.message ?? err);
  }
}

const DURATION_BUCKET_SCORE = {
  lt_2m: 1,
  m2_5m: 3.5,
  m5_10m: 7.5,
  m10_20m: 15,
  gt_20m: 22,
  unknown: null,
};

export async function summarizePracticeAnalytics(practiceId) {
  const practiceHash = hashAnalyticsId(practiceId);
  if (!practiceHash) {
    return null;
  }

  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["eventType"],
    where: { practiceHash },
    _count: { _all: true },
  });
  const byType = Object.fromEntries(grouped.map((g) => [g.eventType, g._count._all]));

  const pick = (type) => Number(byType[type] || 0);

  const [patientLangRows, doctorLangRows, pairRows, bucketRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT COALESCE(metadata->>'patientLanguage', '') AS lang, COUNT(*)::int AS c
      FROM "AnalyticsEvent"
      WHERE "practiceHash" = ${practiceHash}
        AND metadata IS NOT NULL
        AND metadata->>'patientLanguage' IS NOT NULL
        AND metadata->>'patientLanguage' != ''
        AND "eventType" IN ('previsit_started', 'language_pair_used', 'previsit_language_selected')
      GROUP BY 1
      ORDER BY c DESC
      LIMIT 12`,
    prisma.$queryRaw`
      SELECT COALESCE(metadata->>'doctorLanguage', '') AS lang, COUNT(*)::int AS c
      FROM "AnalyticsEvent"
      WHERE "practiceHash" = ${practiceHash}
        AND metadata IS NOT NULL
        AND metadata->>'doctorLanguage' IS NOT NULL
        AND metadata->>'doctorLanguage' != ''
        AND "eventType" IN ('previsit_started', 'language_pair_used', 'previsit_language_selected')
      GROUP BY 1
      ORDER BY c DESC
      LIMIT 12`,
    prisma.$queryRaw`
      SELECT
        CONCAT(
          COALESCE(metadata->>'patientLanguage', ''),
          '|',
          COALESCE(metadata->>'doctorLanguage', '')
        ) AS pair,
        COUNT(*)::int AS c
      FROM "AnalyticsEvent"
      WHERE "practiceHash" = ${practiceHash}
        AND metadata IS NOT NULL
        AND ("eventType" = 'language_pair_used' OR "eventType" = 'previsit_started')
      GROUP BY 1
      HAVING CONCAT(
          COALESCE(metadata->>'patientLanguage', ''),
          '|',
          COALESCE(metadata->>'doctorLanguage', '')
        ) != '|'
      ORDER BY c DESC
      LIMIT 12`,
    prisma.$queryRaw`
      SELECT COALESCE(metadata->>'sessionDurationBucket', '') AS bucket, COUNT(*)::int AS c
      FROM "AnalyticsEvent"
      WHERE "practiceHash" = ${practiceHash}
        AND metadata IS NOT NULL
        AND metadata->>'sessionDurationBucket' IS NOT NULL
        AND metadata->>'sessionDurationBucket' != ''
      GROUP BY 1
      ORDER BY c DESC
      LIMIT 12`,
  ]);

  let avgBucket = null;
  const buckets = Array.isArray(bucketRows)
    ? bucketRows
        .filter((r) => r.bucket && DURATION_BUCKET_SCORE[r.bucket] != null)
        .map((r) => ({ bucket: r.bucket, count: Number(r.c) || 0 }))
    : [];
  if (buckets.length > 0) {
    let sum = 0;
    let n = 0;
    for (const b of buckets) {
      const score = DURATION_BUCKET_SCORE[b.bucket];
      if (typeof score === "number") {
        sum += score * b.count;
        n += b.count;
      }
    }
    if (n > 0) avgBucket = Math.round((sum / n) * 10) / 10;
  }

  const activeQrTargets = await prisma.practiceQrTarget.count({
    where: { practiceProfileId: practiceId, isActive: true },
  });

  return {
    previsitStarts: pick("previsit_started"),
    pdfCreated: pick("previsit_pdf_created"),
    pdfSent: pick("previsit_pdf_sent"),
    qrLandingOpens: pick("qr_landing_opened"),
    qrPrevisitStarts: pick("qr_previsit_started"),
    patientLanguages: (patientLangRows || [])
      .filter((r) => r.lang)
      .map((r) => ({ language: r.lang, count: Number(r.c) || 0 })),
    doctorLanguages: (doctorLangRows || [])
      .filter((r) => r.lang)
      .map((r) => ({ language: r.lang, count: Number(r.c) || 0 })),
    languagePairs: (pairRows || [])
      .filter((r) => r.pair && r.pair !== "|")
      .map((r) => ({ pair: r.pair, count: Number(r.c) || 0 })),
    speechInputUses: pick("speech_input_used"),
    textToSpeechUses: pick("text_to_speech_used"),
    followUpsCreated: pick("followup_created"),
    activeQrTargets,
    completionBuckets: buckets,
    avgCompletionBucketScore: avgBucket,
  };
}
