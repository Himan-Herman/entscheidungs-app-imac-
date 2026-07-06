export function formatBodyMapRegionFallback(organId) {
  return String(organId || "").replace(/_/g, " ").trim();
}

export function getBodyMapRegionLabel(bodyMapMessages, organId) {
  if (!organId) return "";
  return (
    bodyMapMessages?.regions?.[organId] ||
    formatBodyMapRegionFallback(organId)
  );
}
