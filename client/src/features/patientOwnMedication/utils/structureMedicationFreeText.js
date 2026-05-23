/**
 * Lightweight free-text → fields (no medical inference).
 * @param {string} raw
 */
export function structureMedicationFreeText(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const first = lines[0] || text.slice(0, 120);
  let name = first;
  let dosage = "";
  let schedule = "";

  const doseMatch = first.match(/^(.+?)\s+(\d+[\d.,/]*\s*(?:mg|mcg|µg|g|ml|IE|I\.E\.|Stück|Tbl\.?|Tropfen)?)\s*$/i);
  if (doseMatch) {
    name = doseMatch[1].trim();
    dosage = doseMatch[2].trim();
  }

  if (lines.length > 1) {
    schedule = lines.slice(1).join(" · ");
  }

  return {
    name: name.slice(0, 200),
    dosage: dosage.slice(0, 120),
    schedule: schedule.slice(0, 200),
    instructions: lines.length > 2 ? lines.slice(2).join("\n").slice(0, 500) : "",
  };
}
