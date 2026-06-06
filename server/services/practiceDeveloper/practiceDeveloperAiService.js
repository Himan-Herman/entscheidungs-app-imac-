/**
 * Organizational AI for developer docs — dummy data only, no PHI.
 */

export async function developerAiWebhookExplanation(body, { locale } = {}) {
  const lang = locale === "en" || body?.locale === "en" ? "en" : "de";
  const text =
    lang === "en"
      ? `Webhooks send metadata-only JSON (eventId, eventType, resource ids). Verify HMAC using X-MedScoutX-Timestamp and X-MedScoutX-Signature. Event: ${body?.eventType || "example.event"}.`
      : `Webhooks senden nur Metadaten-JSON (eventId, eventType, Ressourcen-IDs). HMAC mit X-MedScoutX-Timestamp und X-MedScoutX-Signature prüfen. Event: ${body?.eventType || "example.event"}.`;
  return {
    text,
    aiSuggestion: true,
    disclaimer:
      lang === "en"
        ? "AI note – please review. AI only supports technical and organizational explanations of API/webhooks."
        : "Smart-Hinweis – bitte prüfen. Unterstützt nur bei technischer und organisatorischer Erklärung von API/Webhooks.",
  };
}

export async function developerAiTestPayload() {
  return {
    payload: {
      eventId: "00000000-0000-4000-8000-000000000001",
      eventType: "test.ping",
      occurredAt: new Date().toISOString(),
      practiceProfileId: "practice_example",
      resourceType: "test",
      resourceId: "test_resource",
      test: true,
      message: "test",
    },
    aiSuggestion: true,
  };
}
