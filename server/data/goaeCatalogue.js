/**
 * GOÄ catalogue — small curated test subset for validation and testing only.
 *
 * IMPORTANT: This is NOT a complete, authoritative GOÄ catalogue.
 * It contains a small hand-curated subset of common GOÄ positions for the purpose
 * of basic ziffer validation and plausibility hinting only.
 *
 * Points values and descriptions MUST be verified against the current official GOÄ text
 * (see sourceUrl below) before any clinical or billing use. The catalogue is
 * intentionally conservative: entries with uncertain point values have points: null.
 *
 * TODO: Replace this test subset with a full structured catalogue once an official
 * machine-readable GOÄ source (e.g. from BÄK or official XML feed) is available
 * and legally cleared for redistribution.
 *
 * Source: Gebührenordnung für Ärzte (GOÄ), BGBl. I 1982 Nr. 49, and its amendments.
 * Official text: https://www.gesetze-im-internet.de/go__1982/
 * Anlage (fee schedule): https://www.gesetze-im-internet.de/go__1982/anlage.html
 */

/** Catalogue metadata — always include in API responses and result summaries. */
export const GOAE_CATALOGUE_META = {
  sourceName: "Gebührenordnung für Ärzte (GOÄ) — Gesetze im Internet / Anlage Gebührenverzeichnis",
  sourceUrl: "https://www.gesetze-im-internet.de/go__1982/",
  anlageUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
  legalStatus: "official-source-test-subset",
  catalogueCompleteness: "test-subset-only",
  accessDate: "2026-01",
  disclaimer:
    "TEST SUBSET ONLY — not a complete or authoritative GOÄ catalogue. " +
    "Source: official Gesetze im Internet GOÄ / Anlage Gebührenverzeichnis. " +
    "Points values and descriptions must be verified against the current official GOÄ text " +
    "before any clinical or billing use. This tool does not produce legally binding billing " +
    "decisions, medical advice, or reimbursement determinations.",
};

/**
 * GOÄ factor thresholds defined by § 5 GOÄ.
 * Above JUSTIFICATION_THRESHOLD, written justification is required.
 * These thresholds are well-established in the official GOÄ text.
 */
export const GOAE_FACTOR_THRESHOLDS = {
  /** Standard upper bound for medical/advisory services (§ 5 Abs. 2 GOÄ). */
  JUSTIFICATION_THRESHOLD: 2.3,
  /** Absolute maximum for medical/advisory services (§ 5 Abs. 2 GOÄ). */
  MAX_MEDICAL: 3.5,
  /** Standard upper bound for technical services (§ 5 Abs. 3 GOÄ). */
  MAX_TECHNICAL_STANDARD: 1.15,
  /** Absolute maximum for technical services (§ 5 Abs. 3 GOÄ). */
  MAX_TECHNICAL: 1.3,
};

/**
 * Small curated test subset of well-known GOÄ entries.
 *
 * Fields:
 *   ziffer       — GOÄ number as string (may include letter suffix e.g. "1a")
 *   title        — Short German description from the official fee schedule (Anlage)
 *   points       — Punkte from official Anlage, or null if uncertain
 *   section      — GOÄ section / Abschnitt (A, B, C, ...) for reference
 *   notes        — Brief English annotation (not shown in UI)
 *   source       — "goae_official_subset" for all entries in this file
 *
 * @type {Array<{
 *   ziffer: string,
 *   title: string,
 *   points: number | null,
 *   section: string,
 *   notes: string,
 *   source: string
 * }>}
 */
export const GOAE_ENTRIES = [
  {
    ziffer: "1",
    title: "Beratung, auch mittels Fernsprecher",
    points: 80,
    section: "A",
    notes: "Oral or telephone consultation. Cannot be combined with Nr. 3 on the same day.",
    source: "goae_official_subset",
  },
  {
    ziffer: "3",
    title: "Eingehende Beratung, mindestens 10 Minuten",
    points: 150,
    section: "A",
    notes: "In-depth consultation, minimum 10 minutes. Cannot be combined with Nr. 1 on same day.",
    source: "goae_official_subset",
  },
  {
    ziffer: "5",
    title: "Symptombezogene Untersuchung",
    points: null,
    section: "B",
    notes: "Symptom-related physical examination. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "7",
    title: "Vollständige körperliche Untersuchung (Ganzkörperstatus)",
    points: null,
    section: "B",
    notes: "Comprehensive full-body examination. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "15",
    title: "Blutentnahme durch Venenpunktion",
    points: null,
    section: "C",
    notes: "Blood draw by venipuncture. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "17",
    title: "Infusion, intravenös bis zu 30 Minuten",
    points: null,
    section: "C",
    notes: "Intravenous infusion up to 30 minutes. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "18",
    title: "Infusion, intravenös mehr als 30 Minuten",
    points: null,
    section: "C",
    notes: "Intravenous infusion more than 30 minutes. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "34",
    title: "Erörterung der Befunde und der Behandlungsmöglichkeiten, mindestens 20 Minuten",
    points: null,
    section: "A",
    notes: "Discussion of findings and treatment options, minimum 20 minutes. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "50",
    title: "Hausbesuch einschließlich Beratung und Untersuchung",
    points: null,
    section: "D",
    notes: "Home visit including consultation and examination. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "51",
    title: "Hausbesuch außerhalb der üblichen Arbeitszeit",
    points: null,
    section: "D",
    notes: "Home visit outside regular hours. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "100",
    title: "Untersuchung nach Nr. 6 oder 8 mit umfassender Befunddokumentation",
    points: null,
    section: "B",
    notes: "Examination with comprehensive findings documentation. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
  {
    ziffer: "250",
    title: "Blutentnahme mittels Spritze, Kanüle oder Katheter",
    points: null,
    section: "M",
    notes: "Blood collection by syringe, needle or catheter. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
  },
];
