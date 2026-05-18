import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import { CONSENT_TYPES } from "./consentTypes.js";

const prisma = new PrismaClient();

const DISCLAIMER_DE =
  "Die KI unterstützt nur bei organisatorischen Erläuterungen zu Zustimmungen.";
const DISCLAIMER_EN =
  "AI only supports organizational explanations regarding consents.";

const TYPE_LABELS = {
  de: {
    profile_access: "Profilzugriff (organisatorische Stammdaten)",
    document_sharing: "Dokumentfreigabe (organisatorische Unterlagen)",
    medication_plan_access: "Medikationsplan (organisatorische Übersicht)",
    secure_messaging: "Sichere Nachrichten",
    data_export: "Datenexport",
    ai_organizational_assistance: "KI-Unterstützung (nur organisatorisch)",
    optional_email_notifications: "E-Mail-Benachrichtigungen (optional)",
    optional_secure_links: "Sichere Download-Links (optional)",
  },
  en: {
    profile_access: "Profile access (organizational details)",
    document_sharing: "Document sharing (organizational files)",
    medication_plan_access: "Medication plan (organizational overview)",
    secure_messaging: "Secure messaging",
    data_export: "Data export",
    ai_organizational_assistance: "AI assistance (organizational only)",
    optional_email_notifications: "Email notifications (optional)",
    optional_secure_links: "Secure download links (optional)",
  },
};

/**
 * Rule-based organizational explanation — no legal or medical advice.
 * @param {{ consentId: string, patientUserId: string, locale?: string, req?: import('express').Request }} input
 */
export async function generateConsentAiExplanation(input) {
  const consentId = String(input.consentId || "").trim();
  const patientUserId = String(input.patientUserId || "").trim();
  if (!consentId || !patientUserId) throw new Error("validation_required");

  const row = await prisma.consentRecord.findFirst({
    where: { id: consentId, patientUserId },
    include: {
      patientUser: { select: { id: true } },
    },
  });
  if (!row) throw new Error("consent_not_found");

  let practiceName = null;
  if (row.practiceProfileId) {
    const practice = await prisma.practiceProfile.findUnique({
      where: { id: row.practiceProfileId },
      select: { practiceName: true },
    });
    practiceName = practice?.practiceName || null;
  }

  const de = String(input.locale || "de").toLowerCase().startsWith("en") ? false : true;
  const notProvided = de ? "nicht angegeben" : "not provided";
  const labels = de ? TYPE_LABELS.de : TYPE_LABELS.en;
  const typeLabel = labels[row.consentType] || row.consentType;

  const statusLabel =
    row.status === "granted"
      ? de
        ? "aktiv"
        : "active"
      : row.status === "revoked"
        ? de
          ? "widerrufen"
          : "revoked"
        : de
          ? "abgelaufen"
          : "expired";

  const lines = de
    ? [
        "Organisatorische Erläuterung (keine Rechts- oder Medizinberatung):",
        `• Art der Zustimmung: ${typeLabel}`,
        `• Status: ${statusLabel}`,
        `• Praxis: ${practiceName || notProvided}`,
        `• Erteilt am: ${row.grantedAt ? new Date(row.grantedAt).toLocaleDateString("de-DE") : notProvided}`,
        `• Ablauf: ${row.expiresAt ? new Date(row.expiresAt).toLocaleDateString("de-DE") : notProvided}`,
        "• Zweck: Zugriff nur auf die ausgewählten organisatorischen Bereiche — keine Diagnose oder Therapieempfehlung.",
        "• Widerruf: jederzeit möglich; danach wird der Zugriff für diesen Bereich blockiert.",
      ]
    : [
        "Organizational explanation (no legal or medical advice):",
        `• Consent type: ${typeLabel}`,
        `• Status: ${statusLabel}`,
        `• Practice: ${practiceName || notProvided}`,
        `• Granted on: ${row.grantedAt ? new Date(row.grantedAt).toLocaleDateString("en-GB") : notProvided}`,
        `• Expires: ${row.expiresAt ? new Date(row.expiresAt).toLocaleDateString("en-GB") : notProvided}`,
        "• Purpose: access only to selected organizational areas — no diagnosis or treatment advice.",
        "• Revocation: available at any time; access for this area is then blocked.",
      ];

  await writeAuditLog({
    req: input.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "consent_ai_explanation_created",
    entityType: "consent_record",
    entityId: consentId,
    practiceProfileId: row.practiceProfileId,
    patientUserId,
    practicePatientLinkId: row.practicePatientLinkId,
    metadata: { consentType: row.consentType },
  });

  return {
    label: de ? "KI-Hinweis – bitte prüfen" : "AI note – please review",
    disclaimer: de ? DISCLAIMER_DE : DISCLAIMER_EN,
    text: lines.join("\n"),
    aiGenerated: true,
    consentTypes: CONSENT_TYPES,
  };
}
