export const APPOINTMENT_STATUSES = new Set([
  "requested",
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "rescheduled",
]);

export const LOCATION_TYPES = new Set([
  "practice",
  "video",
  "phone",
  "external",
  "unknown",
]);

export const DEFAULT_APPOINTMENT_TYPES = [
  { nameKey: "initial_consultation", durationMinutes: 30, color: "#0F766E" },
  { nameKey: "follow_up", durationMinutes: 20, color: "#2563EB" },
  { nameKey: "document_review", durationMinutes: 30, color: "#7C3AED" },
  { nameKey: "phone", durationMinutes: 15, color: "#CA8A04" },
  { nameKey: "video", durationMinutes: 30, color: "#0891B2" },
  { nameKey: "other", durationMinutes: 30, color: "#6B7280" },
];

export const DEFAULT_TYPE_NAMES = {
  de: {
    initial_consultation: "Erstgespräch",
    follow_up: "Kontrolltermin",
    document_review: "Dokumentenbesprechung",
    phone: "Telefontermin",
    video: "Videosprechstunde",
    other: "Sonstiges",
  },
  en: {
    initial_consultation: "Initial consultation",
    follow_up: "Follow-up visit",
    document_review: "Document review",
    phone: "Phone appointment",
    video: "Video visit",
    other: "Other",
  },
};

export function defaultTypeDisplayName(nameKey, locale = "de") {
  const lang = String(locale).toLowerCase().startsWith("en") ? "en" : "de";
  return DEFAULT_TYPE_NAMES[lang][nameKey] || nameKey;
}
