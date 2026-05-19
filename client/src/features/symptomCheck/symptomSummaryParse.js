export const SYMPTOM_JSON_START = "<<<MEDSCOUTX_SYMPTOM_CHECK_JSON>>>";
export const SYMPTOM_JSON_END = "<<<END_MEDSCOUTX_SYMPTOM_CHECK_JSON>>>";

/**
 * @param {string} raw
 */
export function splitSymptomAssistantResponse(raw) {
  const text = String(raw ?? "");
  const start = text.indexOf(SYMPTOM_JSON_START);
  if (start === -1) {
    return { displayText: text.trim(), summaryRaw: null };
  }

  const jsonStart = start + SYMPTOM_JSON_START.length;
  const end = text.indexOf(SYMPTOM_JSON_END, jsonStart);
  const displayText = (
    text.slice(0, start) + (end === -1 ? "" : text.slice(end + SYMPTOM_JSON_END.length))
  ).trim();

  const jsonSlice = (end === -1 ? text.slice(jsonStart) : text.slice(jsonStart, end)).trim();

  try {
    const summaryRaw = JSON.parse(jsonSlice);
    if (summaryRaw && typeof summaryRaw === "object") {
      return { displayText, summaryRaw };
    }
  } catch {
    /* ignore */
  }
  return { displayText, summaryRaw: null };
}

/**
 * @param {object | null} raw
 */
export function normalizeSymptomSummary(raw) {
  if (!raw || typeof raw !== "object") return null;

  const pick = (key) => {
    const v = raw[key];
    return typeof v === "string" ? v.trim() : "";
  };

  const specialties = Array.isArray(raw.specialties)
    ? raw.specialties.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
    : [];

  const visitTopics = Array.isArray(raw.visitTopics)
    ? raw.visitTopics.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    mainComplaints: pick("mainComplaints") || pick("complaints") || "",
    location: pick("location") || pick("region") || "",
    timeline: pick("timeline") || "",
    associatedFactors: pick("associatedFactors") || pick("factors") || "",
    symptomSummary: pick("symptomSummary") || pick("summary") || "",
    specialties,
    visitTopics,
  };
}
