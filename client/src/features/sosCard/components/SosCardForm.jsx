import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { EMERGENCY_LANGUAGES } from "../emergencyLanguages.js";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-", "O+", "O-"];
const SEX_VALUES = ["MALE", "FEMALE", "DIVERSE_INTERSEX", "UNKNOWN", "PREFER_NOT_TO_SAY"];
const PREGNANCY_VALUES = ["UNKNOWN", "NO", "YES", "NOT_APPLICABLE", "PREFER_NOT_TO_SAY"];

// Edit destinations for referenced (read-only) data, so every visibility toggle has a clear
// "where to maintain it" path. Profile = account health data (height/weight, DOB → age);
// health record = allergies/diagnoses.
const PROFILE_EDIT_PATH = "/account/health";
const HEALTH_RECORD_PATH = "/patient/health-history";

// Visibility flags in display order. Defaults match the backend schema:
// identifying / sensitive fields are opt-in (false), the rest visible.
const VISIBILITY_KEYS = [
  "showBloodType",
  "showAge",
  "showDateOfBirth",
  "showBiologicalSex",
  "showHeight",
  "showWeight",
  "showAllergies",
  "showDiagnoses",
  "showMedications",
  "showImplants",
  "showPregnancyStatus",
  "showEmergencyContacts",
  "showFirstResponderNote",
  "showAiSummary",
  "showPreferredLanguage",
];
// Data-minimised defaults (DSGVO Art. 5(1)(c)): a new card exposes nothing sensitive
// until the patient opts in. Only non-health basics default to visible; mirrors the
// SosCard Prisma defaults so client and server agree.
const VISIBILITY_DEFAULT_TRUE = new Set(["showAge", "showPreferredLanguage"]);

function initVisibility(card) {
  const out = {};
  for (const key of VISIBILITY_KEYS) {
    if (card && typeof card[key] === "boolean") out[key] = card[key];
    else out[key] = VISIBILITY_DEFAULT_TRUE.has(key);
  }
  return out;
}

function initList(value) {
  return Array.isArray(value) ? value.map((x) => ({ ...x })) : [];
}

/**
 * Patient SOS-Karte editor.
 * Only fields the Phase-1 API supports are editable here.
 * Age / date of birth / height / weight are referenced read-only from the profile (`referenced`);
 * the patient can only toggle their emergency visibility, not edit them here.
 *
 * @param {{
 *   card: object | null;
 *   referenced: { dateOfBirth?: string|null; age?: number|null; heightCm?: number|null; weightKg?: number|null } | null;
 *   allergiesCount?: number;
 *   diagnosesCount?: number;
 *   saving: boolean;
 *   onSave: (data: object) => void;
 *   t: object;
 * }} props
 */
export default function SosCardForm({
  card,
  referenced,
  allergiesCount = 0,
  diagnosesCount = 0,
  saving,
  onSave,
  t,
}) {
  const ref = referenced || {};

  const [bloodType, setBloodType] = useState(card?.bloodType || "");
  const [biologicalSex, setBiologicalSex] = useState(card?.emergencyBiologicalSex || "");
  const [pregnancyStatus, setPregnancyStatus] = useState(card?.pregnancyStatus || "");
  const [preferredLanguage, setPreferredLanguage] = useState(card?.preferredEmergencyLanguage || "");
  const [ec1Name, setEc1Name] = useState(card?.emergencyContact1Name || "");
  const [ec1Phone, setEc1Phone] = useState(card?.emergencyContact1Phone || "");
  const [ec2Name, setEc2Name] = useState(card?.emergencyContact2Name || "");
  const [ec2Phone, setEc2Phone] = useState(card?.emergencyContact2Phone || "");
  const [note, setNote] = useState(card?.firstResponderNote || "");
  const [medications, setMedications] = useState(() => initList(card?.medications));
  const [implants, setImplants] = useState(() => initList(card?.implants));
  const [visibility, setVisibility] = useState(() => initVisibility(card));

  function updateMed(i, field, value) {
    setMedications((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }
  function updateImplant(i, field, value) {
    setImplants((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }
  function toggleVisibility(key) {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function cleanList(list) {
    return list
      .map((item) => {
        const out = {};
        for (const [k, v] of Object.entries(item)) {
          if (typeof v === "string") {
            const s = v.trim();
            if (s) out[k] = s;
          }
        }
        return out;
      })
      .filter((item) => item.name);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      bloodType: bloodType || null,
      emergencyContact1Name: ec1Name || null,
      emergencyContact1Phone: ec1Phone || null,
      emergencyContact2Name: ec2Name || null,
      emergencyContact2Phone: ec2Phone || null,
      firstResponderNote: note || null,
      emergencyBiologicalSex: biologicalSex || null,
      pregnancyStatus: pregnancyStatus || null,
      preferredEmergencyLanguage: preferredLanguage || null,
      medications: cleanList(medications),
      implants: cleanList(implants),
      ...visibility,
    });
  }

  const hasAge = typeof ref.age === "number";
  const hasDob = Boolean(ref.dateOfBirth);
  const hasHeight = typeof ref.heightCm === "number";
  const hasWeight = typeof ref.weightKg === "number";

  // Read-only fields with a clear source + edit destination. Each maps to a visibility toggle
  // so the patient can see where the underlying data is maintained (profile / health record).
  const referencedRows = [
    { id: "age", label: t.ageLabel, value: hasAge ? `${ref.age} ${t.years}` : "", path: PROFILE_EDIT_PATH, editLabel: t.editInProfile },
    { id: "dob", label: t.dateOfBirthLabel, value: hasDob ? new Date(ref.dateOfBirth).toLocaleDateString() : "", path: PROFILE_EDIT_PATH, editLabel: t.editInProfile },
    { id: "height", label: t.heightLabel, value: hasHeight ? `${ref.heightCm} ${t.heightUnit}` : "", path: PROFILE_EDIT_PATH, editLabel: t.editInProfile },
    { id: "weight", label: t.weightLabel, value: hasWeight ? `${ref.weightKg} ${t.weightUnit}` : "", path: PROFILE_EDIT_PATH, editLabel: t.editInProfile },
    { id: "allergies", label: t.allergiesHeading, value: allergiesCount > 0 ? `${allergiesCount} ${t.entriesLabel}` : t.noEntries, path: HEALTH_RECORD_PATH, editLabel: t.editInHealthRecord },
    { id: "diagnoses", label: t.diagnosesHeading, value: diagnosesCount > 0 ? `${diagnosesCount} ${t.entriesLabel}` : t.noEntries, path: HEALTH_RECORD_PATH, editLabel: t.editInHealthRecord },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset className="sos-card__fieldset">
        <legend className="sos-card__legend">{t.medicalDataLegend}</legend>
        <p className="sos-card__hint" id="sos-self-reported-hint">
          {t.notValidated} {t.voluntaryHint}
        </p>

        {/* Blood type */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.bloodTypeSection}</p>
          <div className="sos-card__field">
            <label className="sos-card__label" htmlFor="sos-blood-type">
              {t.bloodTypeLabel}
            </label>
            <select
              id="sos-blood-type"
              className="sos-card__select"
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
            >
              <option value="">{t.bloodTypeNone}</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Referenced read-only data — age / DOB / height / weight from the profile and
            allergies / diagnoses from the health record. Each row shows the current value
            (or "not yet set") plus a link to where it is maintained, so every visibility
            toggle below has a clear, non-duplicated data source. */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.referencedSection}</p>
          <p className="sos-card__hint">{t.referencedHint}</p>
          <div className="sos-card__ref-list">
            {referencedRows.map((r) => (
              <div key={r.id} className="sos-card__ref-row">
                <div className="sos-card__ref-main">
                  <span className="sos-card__label">{r.label}</span>
                  <span className="sos-card__ref-value">
                    {r.value ? r.value : <span className="sos-card__na">{t.notYetSet}</span>}
                  </span>
                </div>
                <Link to={r.path} className="sos-card__ref-link">
                  {r.editLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Biological sex */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.biologicalSexSection}</p>
          <div className="sos-card__field">
            <label className="sos-card__label" htmlFor="sos-bio-sex">
              {t.biologicalSexLabel}
            </label>
            <select
              id="sos-bio-sex"
              className="sos-card__select"
              value={biologicalSex}
              onChange={(e) => setBiologicalSex(e.target.value)}
              aria-describedby="sos-bio-sex-hint"
            >
              <option value="">{t.notSpecified}</option>
              {SEX_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t.biologicalSexValues?.[v] || v}
                </option>
              ))}
            </select>
            <p className="sos-card__hint" id="sos-bio-sex-hint">
              {t.biologicalSexHint}
            </p>
          </div>
        </div>

        {/* Pregnancy */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.pregnancySection}</p>
          <div className="sos-card__field">
            <label className="sos-card__label" htmlFor="sos-pregnancy">
              {t.pregnancyLabel}
            </label>
            <select
              id="sos-pregnancy"
              className="sos-card__select"
              value={pregnancyStatus}
              onChange={(e) => setPregnancyStatus(e.target.value)}
              aria-describedby="sos-pregnancy-hint"
            >
              <option value="">{t.notSpecified}</option>
              {PREGNANCY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t.pregnancyValues?.[v] || v}
                </option>
              ))}
            </select>
            <p className="sos-card__hint" id="sos-pregnancy-hint">
              {t.pregnancyHint}
            </p>
          </div>
        </div>

        {/* Medications */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.medications.section}</p>
          <p className="sos-card__hint">{t.medications.hint}</p>
          {medications.length === 0 && <p className="sos-card__empty">{t.medications.empty}</p>}
          {medications.map((m, i) => (
            <div key={i} className="sos-card__entry">
              <div className="sos-card__entry-grid">
                <div>
                  <label className="sos-card__label" htmlFor={`sos-med-${i}-name`}>
                    {t.medications.name}
                  </label>
                  <input
                    id={`sos-med-${i}-name`}
                    className="sos-card__input"
                    type="text"
                    maxLength={120}
                    value={m.name || ""}
                    onChange={(e) => updateMed(i, "name", e.target.value)}
                    placeholder={t.medications.namePlaceholder}
                  />
                </div>
                <div>
                  <label className="sos-card__label" htmlFor={`sos-med-${i}-dose`}>
                    {t.medications.dose}
                  </label>
                  <input
                    id={`sos-med-${i}-dose`}
                    className="sos-card__input"
                    type="text"
                    maxLength={80}
                    value={m.dose || ""}
                    onChange={(e) => updateMed(i, "dose", e.target.value)}
                    placeholder={t.medications.dosePlaceholder}
                  />
                </div>
                <div>
                  <label className="sos-card__label" htmlFor={`sos-med-${i}-freq`}>
                    {t.medications.frequency}
                  </label>
                  <input
                    id={`sos-med-${i}-freq`}
                    className="sos-card__input"
                    type="text"
                    maxLength={80}
                    value={m.frequency || ""}
                    onChange={(e) => updateMed(i, "frequency", e.target.value)}
                    placeholder={t.medications.frequencyPlaceholder}
                  />
                </div>
                <div>
                  <label className="sos-card__label" htmlFor={`sos-med-${i}-instruction`}>
                    {t.medications.instruction}
                  </label>
                  <input
                    id={`sos-med-${i}-instruction`}
                    className="sos-card__input"
                    type="text"
                    maxLength={200}
                    value={m.instruction || ""}
                    onChange={(e) => updateMed(i, "instruction", e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="sos-card__btn sos-card__btn--danger sos-card__btn--small"
                onClick={() => setMedications((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 size={14} aria-hidden="true" /> {t.medications.remove}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="sos-card__btn sos-card__btn--secondary sos-card__btn--small"
            onClick={() => setMedications((prev) => [...prev, { name: "" }])}
          >
            <Plus size={14} aria-hidden="true" /> {t.medications.add}
          </button>
        </div>

        {/* Implants / devices */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.implants.section}</p>
          <p className="sos-card__hint">{t.implants.hint}</p>
          {implants.length === 0 && <p className="sos-card__empty">{t.implants.empty}</p>}
          {implants.map((m, i) => (
            <div key={i} className="sos-card__entry">
              <div className="sos-card__entry-grid">
                <div>
                  <label className="sos-card__label" htmlFor={`sos-impl-${i}-name`}>
                    {t.implants.name}
                  </label>
                  <input
                    id={`sos-impl-${i}-name`}
                    className="sos-card__input"
                    type="text"
                    maxLength={120}
                    value={m.name || ""}
                    onChange={(e) => updateImplant(i, "name", e.target.value)}
                    placeholder={t.implants.namePlaceholder}
                  />
                </div>
                <div>
                  <label className="sos-card__label" htmlFor={`sos-impl-${i}-region`}>
                    {t.implants.bodyRegion}
                  </label>
                  <input
                    id={`sos-impl-${i}-region`}
                    className="sos-card__input"
                    type="text"
                    maxLength={80}
                    value={m.bodyRegion || ""}
                    onChange={(e) => updateImplant(i, "bodyRegion", e.target.value)}
                    placeholder={t.implants.bodyRegionPlaceholder}
                  />
                </div>
                <div>
                  <label className="sos-card__label" htmlFor={`sos-impl-${i}-manuf`}>
                    {t.implants.manufacturer}
                  </label>
                  <input
                    id={`sos-impl-${i}-manuf`}
                    className="sos-card__input"
                    type="text"
                    maxLength={120}
                    value={m.manufacturer || ""}
                    onChange={(e) => updateImplant(i, "manufacturer", e.target.value)}
                  />
                </div>
                <div>
                  <label className="sos-card__label" htmlFor={`sos-impl-${i}-note`}>
                    {t.implants.note}
                  </label>
                  <input
                    id={`sos-impl-${i}-note`}
                    className="sos-card__input"
                    type="text"
                    maxLength={200}
                    value={m.note || ""}
                    onChange={(e) => updateImplant(i, "note", e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="sos-card__btn sos-card__btn--danger sos-card__btn--small"
                onClick={() => setImplants((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 size={14} aria-hidden="true" /> {t.implants.remove}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="sos-card__btn sos-card__btn--secondary sos-card__btn--small"
            onClick={() => setImplants((prev) => [...prev, { name: "" }])}
          >
            <Plus size={14} aria-hidden="true" /> {t.implants.add}
          </button>
        </div>

        {/* Emergency contacts */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.contactsSection}</p>
          <div className="sos-card__row sos-card__field">
            <div>
              <label className="sos-card__label" htmlFor="sos-ec1-name">
                {t.contact1Name}
              </label>
              <input
                id="sos-ec1-name"
                className="sos-card__input"
                type="text"
                maxLength={120}
                value={ec1Name}
                onChange={(e) => setEc1Name(e.target.value)}
                placeholder={t.contactNamePlaceholder}
              />
            </div>
            <div>
              <label className="sos-card__label" htmlFor="sos-ec1-phone">
                {t.contact1Phone}
              </label>
              <input
                id="sos-ec1-phone"
                className="sos-card__input"
                type="tel"
                maxLength={40}
                value={ec1Phone}
                onChange={(e) => setEc1Phone(e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>
          </div>
          <div className="sos-card__row sos-card__field">
            <div>
              <label className="sos-card__label" htmlFor="sos-ec2-name">
                {t.contact2Name}
              </label>
              <input
                id="sos-ec2-name"
                className="sos-card__input"
                type="text"
                maxLength={120}
                value={ec2Name}
                onChange={(e) => setEc2Name(e.target.value)}
                placeholder={t.contactNamePlaceholder}
              />
            </div>
            <div>
              <label className="sos-card__label" htmlFor="sos-ec2-phone">
                {t.contact2Phone}
              </label>
              <input
                id="sos-ec2-phone"
                className="sos-card__input"
                type="tel"
                maxLength={40}
                value={ec2Phone}
                onChange={(e) => setEc2Phone(e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>
          </div>
        </div>

        {/* Preferred emergency language */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.preferredLanguageSection}</p>
          <div className="sos-card__field">
            <label className="sos-card__label" htmlFor="sos-pref-lang">
              {t.preferredLanguageLabel}
            </label>
            <select
              id="sos-pref-lang"
              className="sos-card__select"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
            >
              <option value="">{t.preferredLanguageNone}</option>
              {EMERGENCY_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* First responder note */}
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.noteSection}</p>
          <div className="sos-card__field">
            <label className="sos-card__label" htmlFor="sos-note">
              {t.noteLabel}
            </label>
            <textarea
              id="sos-note"
              className="sos-card__textarea"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              aria-describedby="sos-note-hint"
            />
            <p className="sos-card__hint" id="sos-note-hint" style={{ marginTop: "0.25rem" }}>
              {t.noteHint}
            </p>
          </div>
        </div>
      </fieldset>

      {/* Field-level visibility */}
      <fieldset className="sos-card__fieldset">
        <legend className="sos-card__legend">{t.visibilityLegend}</legend>
        <p className="sos-card__hint" id="sos-visibility-hint">
          {t.visibilityHint}
        </p>
        <div className="sos-card__section">
          <ul className="sos-card__toggle-list" aria-describedby="sos-visibility-hint">
            {VISIBILITY_KEYS.map((key) => (
              <li key={key} className="sos-card__toggle-row">
                <input
                  id={`sos-vis-${key}`}
                  type="checkbox"
                  className="sos-card__checkbox"
                  checked={Boolean(visibility[key])}
                  onChange={() => toggleVisibility(key)}
                />
                <label htmlFor={`sos-vis-${key}`} className="sos-card__toggle-label">
                  {t.visibility?.[key] || key}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </fieldset>

      <div className="sos-card__actions">
        <button type="submit" className="sos-card__btn sos-card__btn--primary" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
