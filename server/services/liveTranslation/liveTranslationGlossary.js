/** Server-side medical glossary protection block (mirror client medicalGlossary.js). */

export function buildMedicalGlossaryBlock() {
  return `
MEDICAL TERM PROTECTION (preserve exactly — never flip or substitute meaning):
- Negation words (keine/kein/nicht/nie/no/not/never): MUST remain negated in translation.
- Units (mg, ml, kg, cm, mmol, °C): keep numbers and units exactly.
- Durations (seit gestern/since yesterday, seit 3 Tagen/for 3 days): preserve time scope.
- Symptoms: Kopfschmerzen=headache, Fieber=fever, Übelkeit=nausea — do NOT substitute other symptoms.
- Allergies: Allergie=allergy; "keine Allergien" = "no allergies" — NEVER drop negation.
- Body parts: Kopf/head, Bauch/abdomen, Brust/chest — translate anatomical terms faithfully.
- Medication names: keep verbatim or standard generic equivalent; do not replace with different drugs.
- Pregnancy: schwanger=pregnant — preserve exactly.

Negation example:
DE "Ich habe keine Allergien." → Correct EN: "I have no allergies." Wrong: "I have allergies."
`.trim();
}
