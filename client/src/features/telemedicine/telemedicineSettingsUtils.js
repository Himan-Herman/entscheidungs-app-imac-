/**
 * Pure helpers for the telemedicine video-settings UI.
 * Keeps the technical provider values in one place and maps each to an i18n key
 * so the dropdown shows readable, translated labels (never the raw value).
 */

/** Selectable video provider types (technical values stored in the DB). */
export const PROVIDER_TYPES = [
  "sandbox",
  "external_link",
  "jitsi",
  "daily",
  "twilio",
  "whereby",
  "zoom",
  "google_meet",
];

/**
 * i18n key for a provider type label, e.g. "provider_google_meet".
 * Render with: t[providerLabelKey(value)] || value  (raw value as fallback).
 * @param {string} value
 */
export function providerLabelKey(value) {
  return `provider_${value}`;
}
