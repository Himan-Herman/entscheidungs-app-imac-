/** Local consent for body map flow (disclaimer + processing acknowledgement). */
export const BODY_MAP_CONSENT_KEY = "medscoutx_body_map_ack_v1";

export function readBodyMapConsent() {
  try {
    return localStorage.getItem(BODY_MAP_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Neutral selection snapshot for session (optional; URL remains canonical). */
export function rememberBodyMapSelection(organ, aspect) {
  try {
    sessionStorage.setItem(
      "bodyMapSelection",
      JSON.stringify({
        bodyRegionId: String(organ),
        bodyRegionLabel: String(organ).replace(/_/g, " "),
        side: null,
        aspect: aspect === "rueckseite" ? "back" : "front",
      }),
    );
  } catch {
    /* ignore */
  }
}
