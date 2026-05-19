/**
 * Region-specific follow-up hint lists for compact AI prompts (MDR-neutral).
 * @param {string} organName
 * @returns {'head'|'neck'|'chest'|'abdomen'|'back'|'limb'|'skin'|'pelvis'|'default'}
 */
export function categorizeBodyRegion(organName) {
  const n = String(organName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  if (/kopf|hinterkopf|gesicht|auge|ohr|mund|kiefer|stirn|schadel/.test(n)) return "head";
  if (/hals|nacken|kehle/.test(n)) return "neck";
  if (/brust|herz|lunge|thorax|rippe/.test(n)) return "chest";
  if (/bauch|magen|darm|leber|galle|pankreas|bauchspeicheldruse|milz|zwerch/.test(n))
    return "abdomen";
  if (/rucken|rücken|wirbel|schulterblatt|lenden|kreuz/.test(n)) return "back";
  if (/arm|bein|hand|fuß|fuss|knie|ellenbogen|schulter|hufte|hüfte|gelenk/.test(n))
    return "limb";
  if (/haut|nagel/.test(n)) return "skin";
  if (/blase|uterus|prostata|becken|genital/.test(n)) return "pelvis";
  return "default";
}

const HINTS_DE = {
  head: "seit wann; einseitig oder beidseitig; eher Druck oder stechend",
  neck: "seit wann; bei Bewegung; einseitig oder beidseitig",
  chest: "bei Bewegung oder in Ruhe; Druck, Brennen oder Ziehen",
  abdomen: "oben oder unten; nach dem Essen stärker; seit wann",
  back: "oben oder unten; bei Belastung; seit wann",
  limb: "bei Bewegung; welche Bewegung; seit wann",
  skin: "seit wann; Größe oder Veränderung; juckend oder schmerzhaft",
  pelvis: "seit wann; wann tritt es auf; begleitende Beobachtungen",
  default: "seit wann; was fällt auf; was verändert es",
};

const HINTS_EN = {
  head: "how long; one side or both; pressure vs sharp",
  neck: "how long; with movement; one side or both",
  chest: "with movement or at rest; pressure, burning, or pulling",
  abdomen: "upper or lower; worse after eating; how long",
  back: "upper or lower; with strain; how long",
  limb: "with movement; which movement; how long",
  skin: "how long; size or change; itchy or painful",
  pelvis: "how long; when it occurs; related observations",
  default: "how long; what you notice; what changes it",
};

/**
 * @param {string} organName
 * @param {'de'|'en'} locale
 */
export function getRegionQuestionHints(organName, locale = "de") {
  const cat = categorizeBodyRegion(organName);
  const pack = locale === "en" ? HINTS_EN : HINTS_DE;
  return pack[cat] || pack.default;
}
