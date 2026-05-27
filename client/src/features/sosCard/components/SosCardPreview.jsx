import { AlertTriangle, Phone, User } from "lucide-react";

const SEVERITY_ORDER = { life_threatening: 0, severe: 1, moderate: 2, mild: 3 };

/**
 * Read-only card preview — used by patient (own view) and practice.
 * @param {{
 *   card: object | null;
 *   allergies: Array;
 *   diagnoses: Array;
 *   patientName?: string;
 *   t: object;
 * }} props
 */
export default function SosCardPreview({ card, allergies = [], diagnoses = [], patientName, t }) {
  if (!card && !allergies.length) {
    return <p style={{ color: "#9ca3af", fontStyle: "italic" }}>{t.noData}</p>;
  }

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

  return (
    <div>
      {patientName && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <User size={16} />
          <span style={{ fontWeight: 600 }}>{patientName}</span>
        </div>
      )}

      {card?.bloodType && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.bloodTypeLabel}</p>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "#dc2626" }}>
            {card.bloodType}
          </span>
        </div>
      )}

      {sortedAllergies.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">
            <AlertTriangle size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
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

      {diagnoses.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.diagnosesHeading}</p>
          {diagnoses.map((d, i) => (
            <div key={i} style={{ marginBottom: "0.35rem", fontSize: "0.9375rem" }}>
              {d.condition}
              {d.icdCode ? ` (${d.icdCode})` : ""}
              {d.status ? ` — ${t.diagnosisStatuses?.[d.status] || d.status}` : ""}
            </div>
          ))}
        </div>
      )}

      {contacts.length > 0 && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">
            <Phone size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
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

      {card?.firstResponderNote && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.noteLabel}</p>
          <p style={{ fontSize: "0.9375rem", whiteSpace: "pre-wrap", margin: 0 }}>
            {card.firstResponderNote}
          </p>
        </div>
      )}

      {card?.aiSummary && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">{t.aiSummaryLabel}</p>
          <div className="sos-card__ai-summary">{card.aiSummary}</div>
          {card.aiSummaryUpdatedAt && (
            <p className="sos-card__label" style={{ marginTop: "0.5rem" }}>
              {t.aiSummaryUpdated}: {new Date(card.aiSummaryUpdatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
