import { AlertTriangle, Phone, User } from "lucide-react";

const SEVERITY_ORDER = { life_threatening: 0, severe: 1, moderate: 2, mild: 3 };

/**
 * Read-only card preview — used by the patient (mirrors what the public emergency page shows)
 * and by the practice (consent-gated, where field-level visibility is not applied).
 *
 * @param {{
 *   card: object | null;
 *   referenced?: { age?: number|null; dateOfBirth?: string|null; heightCm?: number|null; weightKg?: number|null };
 *   allergies?: Array;
 *   diagnoses?: Array;
 *   patientName?: string;
 *   respectVisibility?: boolean;  // true: honor card.show* flags (patient preview)
 *   t: object;
 * }} props
 */
export default function SosCardPreview({
  card,
  referenced = {},
  allergies = [],
  diagnoses = [],
  patientName,
  respectVisibility = true,
  t,
}) {
  if (!card && !allergies.length) {
    return <p className="sos-card__empty">{t.noData}</p>;
  }

  // When honoring visibility, a field shows only if its flag is not explicitly false.
  const show = (key) => (respectVisibility ? card?.[key] !== false : true);

  const sortedAllergies = [...allergies].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  const contacts = [
    card?.emergencyContact1Name && card?.emergencyContact1Phone
      ? { name: card.emergencyContact1Name, phone: card.emergencyContact1Phone }
      : null,
    card?.emergencyContact2Name && card?.emergencyContact2Phone
      ? { name: card.emergencyContact2Name, phone: card.emergencyContact2Phone }
      : null,
  ].filter(Boolean);

  const medications = Array.isArray(card?.medications) ? card.medications : [];
  const implants = Array.isArray(card?.implants) ? card.implants : [];

  const na = t.notSpecified;
  // Identity scalars to show as a grid (only released ones). value === undefined → skip entirely.
  const identity = [
    show("showBloodType") && { label: t.bloodTypeLabel, value: card?.bloodType, strong: true },
    show("showAge") && typeof referenced.age === "number"
      ? { label: t.ageLabel, value: `${referenced.age} ${t.years}` }
      : show("showAge") && { label: t.ageLabel, value: null },
    show("showDateOfBirth") && referenced.dateOfBirth
      ? { label: t.dateOfBirthLabel, value: new Date(referenced.dateOfBirth).toLocaleDateString() }
      : null,
    show("showBiologicalSex") && {
      label: t.biologicalSexLabel,
      value: card?.emergencyBiologicalSex
        ? t.biologicalSexValues?.[card.emergencyBiologicalSex] || card.emergencyBiologicalSex
        : null,
    },
    show("showHeight") && typeof referenced.heightCm === "number"
      ? { label: t.heightLabel, value: `${referenced.heightCm} ${t.heightUnit}` }
      : null,
    show("showWeight") && typeof referenced.weightKg === "number"
      ? { label: t.weightLabel, value: `${referenced.weightKg} ${t.weightUnit}` }
      : null,
    show("showPregnancyStatus") && card?.pregnancyStatus
      ? {
          label: t.pregnancyLabel,
          value: t.pregnancyValues?.[card.pregnancyStatus] || card.pregnancyStatus,
        }
      : null,
  ].filter(Boolean);

  return (
    <div>
      {patientName && (
        <div className="sos-card__preview-name">
          <User size={16} aria-hidden="true" />
          <span>{patientName}</span>
        </div>
      )}

      <p className="sos-card__hint">{t.selfReported} · {t.notValidated}</p>

      {identity.length > 0 && (
        <div className="sos-card__section">
          <dl className="sos-card__meta-grid">
            {identity.map((item, i) => (
              <div key={i} className="sos-card__meta-item">
                <dt className="sos-card__label">{item.label}</dt>
                <dd
                  className={
                    item.strong ? "sos-card__meta-value sos-card__meta-value--blood" : "sos-card__meta-value"
                  }
                >
                  {item.value || <span className="sos-card__na">{na}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {show("showAllergies") && sortedAllergies.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">
            <AlertTriangle size={14} aria-hidden="true" style={{ display: "inline", marginRight: "0.35rem" }} />
            {t.allergiesHeading}
          </p>
          {sortedAllergies.map((a, i) => (
            <div key={i} className="emergency-card__allergy-item">
              <span className={`emergency-card__severity-badge emergency-card__severity-badge--${a.severity}`}>
                {t.severities?.[a.severity] || a.severity}
              </span>
              <span>
                {a.allergen}
                {a.reaction ? ` — ${a.reaction}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {show("showMedications") && medications.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.medications.section}</p>
          <ul className="sos-card__data-list">
            {medications.map((m, i) => (
              <li key={i} className="sos-card__data-item">
                <strong>{m.name}</strong>
                {m.dose ? ` · ${m.dose}` : ""}
                {m.frequency ? ` · ${m.frequency}` : ""}
                {m.instruction ? ` — ${m.instruction}` : ""}
                {m.note ? ` (${m.note})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {show("showDiagnoses") && diagnoses.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.diagnosesHeading}</p>
          {diagnoses.map((d, i) => (
            <div key={i} className="sos-card__data-item">
              {d.condition}
              {d.icdCode ? ` (${d.icdCode})` : ""}
              {d.status ? ` — ${t.diagnosisStatuses?.[d.status] || d.status}` : ""}
            </div>
          ))}
        </div>
      )}

      {show("showImplants") && implants.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.implants.section}</p>
          <ul className="sos-card__data-list">
            {implants.map((m, i) => (
              <li key={i} className="sos-card__data-item">
                <strong>{m.name}</strong>
                {m.bodyRegion ? ` · ${m.bodyRegion}` : ""}
                {m.manufacturer ? ` · ${m.manufacturer}` : ""}
                {m.note ? ` (${m.note})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {show("showEmergencyContacts") && contacts.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">
            <Phone size={14} aria-hidden="true" style={{ display: "inline", marginRight: "0.35rem" }} />
            {t.contactsSection}
          </p>
          {contacts.map((c, i) => (
            <div key={i} className="emergency-card__contact">
              <strong>{c.name}</strong>{" "}
              <a href={`tel:${c.phone}`}>{c.phone}</a>
            </div>
          ))}
        </div>
      )}

      {show("showPreferredLanguage") && card?.preferredEmergencyLanguage && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.preferredLanguageLabel}</p>
          <p className="sos-card__data-item">
            {t.languageNames?.[card.preferredEmergencyLanguage] || card.preferredEmergencyLanguage}
          </p>
        </div>
      )}

      {show("showFirstResponderNote") && card?.firstResponderNote && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.noteLabel}</p>
          <p className="sos-card__pre">{card.firstResponderNote}</p>
        </div>
      )}

      {show("showAiSummary") && card?.aiSummary && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.aiSummaryLabel}</p>
          <div className="sos-card__ai-summary">{card.aiSummary}</div>
          {card.aiSummaryUpdatedAt && (
            <p className="sos-card__hint" style={{ marginTop: "0.5rem" }}>
              {t.aiSummaryUpdated}: {new Date(card.aiSummaryUpdatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
