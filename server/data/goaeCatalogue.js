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
 *   ziffer                — GOÄ number as string (may include letter suffix e.g. "1a")
 *   title                 — Short German description from the official fee schedule (Anlage)
 *   points                — Punkte from official Anlage, or null if uncertain
 *   section               — GOÄ section / Abschnitt (A, B, C, ...) for reference
 *   notes                 — Brief English annotation (not shown in UI)
 *   source                — "goae_official_subset" for all entries in this file
 *   activeStatus          — "active" or "deprecated"
 *   completenessStatus    — "verified" | "points-uncertain" | "needs-review"
 *                           "verified": points value and title confirmed from official source
 *                           "points-uncertain": ziffer/title reasonable but points: null
 *                           "needs-review": title, section, or ziffer needs human re-check
 *   sourceName            — Name of the source document for this entry
 *   sourceUrl             — URL of the official source used for this entry
 *   sourceLineOrReference — Section/number reference within the source, or null
 *   sourceVersionDate     — ISO date (YYYY-MM or YYYY-MM-DD) of the source version checked, or null
 *   verifiedAt            — ISO date when a human last verified this entry against official text, or null
 *
 * @type {Array<{
 *   ziffer: string,
 *   title: string,
 *   points: number | null,
 *   section: string,
 *   notes: string,
 *   source: string,
 *   activeStatus: "active" | "deprecated",
 *   completenessStatus: "verified" | "points-uncertain" | "needs-review",
 *   sourceName: string,
 *   sourceUrl: string,
 *   sourceLineOrReference: string | null,
 *   sourceVersionDate: string | null,
 *   verifiedAt: string | null
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
    activeStatus: "active",
    completenessStatus: "verified",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt A, Nr. 1",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "2",
    title: "Ausstellung von Wiederholungsrezepten und/oder Überweisungsscheinen",
    points: null,
    section: "A",
    notes: "Prescription refill or referral form issuance, per issuance act. Points uncertain and exact title needs verification — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt A, Nr. 2",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "3",
    title: "Eingehende Beratung, mindestens 10 Minuten",
    points: 150,
    section: "A",
    notes: "In-depth consultation, minimum 10 minutes. Cannot be combined with Nr. 1 on same day.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "verified",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt A, Nr. 3",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "5",
    title: "Symptombezogene Untersuchung",
    points: null,
    section: "B",
    notes: "Symptom-related physical examination. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt B, Nr. 5",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "6",
    title: "Untersuchung eines Organsystems",
    points: null,
    section: "B",
    notes: "Examination of an organ system. Points uncertain and exact title needs verification — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt B, Nr. 6",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "7",
    title: "Vollständige körperliche Untersuchung (Ganzkörperstatus)",
    points: null,
    section: "B",
    notes: "Comprehensive full-body examination. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt B, Nr. 7",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "15",
    title: "Blutentnahme durch Venenpunktion",
    points: null,
    section: "C",
    // Section and title assignment for Nr. 15 should be re-checked against the official Anlage.
    // Nr. 15 in the GOÄ Abschnitt structure may differ from section C. Marked needs-review.
    notes: "Blood draw by venipuncture. Points uncertain — verify against official Anlage. Section and title need re-check.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt C, Nr. 15",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "17",
    title: "Infusion, intravenös bis zu 30 Minuten",
    points: null,
    section: "C",
    notes: "Intravenous infusion up to 30 minutes. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt C, Nr. 17",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "18",
    title: "Infusion, intravenös mehr als 30 Minuten",
    points: null,
    section: "C",
    notes: "Intravenous infusion more than 30 minutes. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt C, Nr. 18",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "22",
    title: "Kurze Bescheinigung oder kurzes Zeugnis, nicht für Rentenzwecke",
    points: null,
    section: "A",
    notes: "Brief medical certificate or attestation, not for pension or disability purposes. Points uncertain and exact title needs verification — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt A, Nr. 22",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "34",
    title: "Erörterung der Befunde und der Behandlungsmöglichkeiten, mindestens 20 Minuten",
    points: null,
    section: "A",
    notes: "Discussion of findings and treatment options, minimum 20 minutes. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt A, Nr. 34",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "50",
    title: "Hausbesuch einschließlich Beratung und Untersuchung",
    points: null,
    section: "D",
    notes: "Home visit including consultation and examination. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt D, Nr. 50",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "51",
    title: "Hausbesuch außerhalb der üblichen Arbeitszeit",
    points: null,
    section: "D",
    notes: "Home visit outside regular hours. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt D, Nr. 51",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "55",
    title: "Besuch eines weiteren Patienten in derselben häuslichen Gemeinschaft",
    points: null,
    section: "D",
    notes: "Home visit to an additional patient in the same household, following Nr. 50. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt D, Nr. 55",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "60",
    title: "Konsiliarische Erörterung zwischen zwei Ärzten",
    points: null,
    section: "A",
    notes: "Consult discussion between two physicians. Points uncertain and exact title needs verification — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt A, Nr. 60",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "100",
    title: "Untersuchung nach Nr. 6 oder 8 mit umfassender Befunddokumentation",
    points: null,
    section: "B",
    // Title references Nr. 6 and Nr. 8 which are not yet fully verified in the local catalogue.
    // Section assignment and exact title text need human re-check against the Anlage.
    notes: "Examination with comprehensive findings documentation. Points uncertain — verify against official Anlage. Title references Nr. 6 and Nr. 8 — needs re-check.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt B, Nr. 100",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "250",
    title: "Blutentnahme mittels Spritze, Kanüle oder Katheter",
    points: null,
    section: "M",
    notes: "Blood collection by syringe, needle or catheter. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt M, Nr. 250",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "251",
    title: "Arterielle Blutentnahme",
    points: null,
    section: "M",
    notes: "Arterial blood collection. Points uncertain and exact title needs verification — verify against official Anlage. Section follows adjacent Nr. 250.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt M, Nr. 251",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "252",
    title: "Injektion, intramuskulär oder subkutan oder intradermal",
    points: null,
    section: "C",
    notes: "Injection by intramuscular, subcutaneous, or intradermal route. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt C, Nr. 252",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "253",
    title: "Injektion, intravenös",
    points: null,
    section: "C",
    notes: "Intravenous injection. Points uncertain — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "points-uncertain",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt C, Nr. 253",
    sourceVersionDate: null,
    verifiedAt: null,
  },
  {
    ziffer: "255",
    title: "Injektion, intraartikulär oder intrabursal",
    points: null,
    section: "C",
    notes: "Intraarticular or intrabursal injection. Points uncertain and section assignment needs verification — verify against official Anlage.",
    source: "goae_official_subset",
    activeStatus: "active",
    completenessStatus: "needs-review",
    sourceName: "Gesetze im Internet — GOÄ Anlage",
    sourceUrl: "https://www.gesetze-im-internet.de/go__1982/anlage.html",
    sourceLineOrReference: "Anlage Abschnitt C, Nr. 255",
    sourceVersionDate: null,
    verifiedAt: null,
  },
];
