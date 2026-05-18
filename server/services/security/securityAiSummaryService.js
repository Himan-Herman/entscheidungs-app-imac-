import { getSecuritySummary } from "./securitySummaryService.js";
import { writeAuditLog } from "../auditLogService.js";

const DISCLAIMER_DE =
  "Die KI unterstützt nur organisatorisch bei Datenschutz- und Sicherheitsübersichten.";
const DISCLAIMER_EN =
  "AI only provides organizational support for privacy and security overviews.";

/**
 * Rule-based organizational security checklist — no legal or medical advice.
 * @param {{ practiceProfileId: string, locale?: string, userId?: string, req?: import('express').Request }} input
 */
export async function generateSecurityAiSummary(input) {
  const pid = String(input.practiceProfileId || "").trim();
  if (!pid) throw new Error("validation_required");

  const de = String(input.locale || "de").toLowerCase().startsWith("en") ? false : true;
  const notProvided = de ? "nicht angegeben" : "not provided";
  const summary = await getSecuritySummary(pid);
  const m = summary.metrics;

  const lines = de
    ? [
        "Organisatorische Sicherheits-Checkliste (keine Rechtsberatung, keine medizinische Bewertung):",
        `• Sicherheitsereignisse (7 Tage): ${m.securityEvents7d ?? notProvided}`,
        `• Offene Datenanfragen: ${m.openDataRequests ?? notProvided}`,
        `• Widerrufene sichere Links: ${m.revokedSecureLinks ?? notProvided}`,
        `• Aktive Patientenverbindungen: ${m.activePatientLinks ?? notProvided}`,
        `• Archivierte Verbindungen: ${m.archivedPatientLinks ?? notProvided}`,
        `• Aktive Zustimmungen: ${m.activeConsents ?? notProvided}`,
        `• Abgelaufene Zustimmungen: ${m.expiredConsents ?? notProvided}`,
        "• Prüfen: Sind Rollen nur mit least-privilege vergeben?",
        "• Prüfen: Sind Consents für sensible Bereiche aktiv und dokumentiert?",
        "• Prüfen: Werden Exporte und Downloads nur mit Berechtigung genutzt?",
      ]
    : [
        "Organizational security checklist (no legal advice, no medical assessment):",
        `• Security events (7 days): ${m.securityEvents7d ?? notProvided}`,
        `• Open data requests: ${m.openDataRequests ?? notProvided}`,
        `• Revoked secure links: ${m.revokedSecureLinks ?? notProvided}`,
        `• Active patient links: ${m.activePatientLinks ?? notProvided}`,
        `• Archived links: ${m.archivedPatientLinks ?? notProvided}`,
        `• Active consents: ${m.activeConsents ?? notProvided}`,
        `• Expired consents: ${m.expiredConsents ?? notProvided}`,
        "• Review: Are roles assigned with least privilege?",
        "• Review: Are consents active for sensitive areas?",
        "• Review: Are exports and downloads permission-gated?",
      ];

  await writeAuditLog({
    req: input.req,
    userId: input.userId ?? null,
    actorRole: "practice",
    action: "security_ai_summary_created",
    entityType: "security_event",
    entityId: pid,
    practiceProfileId: pid,
    severity: "security",
    visibility: "internal",
    metadata: { eventType: "ai_summary" },
  });

  return {
    label: de ? "KI-Hinweis – bitte prüfen" : "AI note – please review",
    disclaimer: de ? DISCLAIMER_DE : DISCLAIMER_EN,
    text: lines.join("\n"),
    aiGenerated: true,
  };
}
