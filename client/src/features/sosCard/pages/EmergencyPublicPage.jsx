import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Phone, ShieldAlert } from "lucide-react";
import { fetchPublicEmergency } from "../api/sosCardApi.js";
import "../styles/SosCard.css";

const SEVERITY_ORDER = { life_threatening: 0, severe: 1, moderate: 2, mild: 3 };

const SEVERITY_LABELS = {
  life_threatening: "Life-threatening",
  severe: "Severe",
  moderate: "Moderate",
  mild: "Mild",
};

export default function EmergencyPublicPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Emergency Medical Card";
    if (!token) { setError("invalid_token"); setLoading(false); return; }
    fetchPublicEmergency(token)
      .then(({ res, data: d }) => {
        if (!res.ok || !d.ok) {
          setError(d?.error === "card_not_found" ? "not_found" : "error");
        } else {
          setData(d);
        }
      })
      .catch(() => setError("error"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="emergency-card">
        <p style={{ color: "#9ca3af" }}>Loading emergency card…</p>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="emergency-card">
        <div className="emergency-card__sos-badge">
          <ShieldAlert size={20} /> SOS
        </div>
        <p>This emergency card is no longer active or the link is invalid.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="emergency-card">
        <p style={{ color: "#dc2626" }}>Unable to load emergency card. Please try again.</p>
      </div>
    );
  }

  const sortedAllergies = [...(data.allergies || [])].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
  const criticalAllergies = sortedAllergies.filter(
    (a) => a.severity === "life_threatening" || a.severity === "severe",
  );
  const otherAllergies = sortedAllergies.filter(
    (a) => a.severity !== "life_threatening" && a.severity !== "severe",
  );

  return (
    <div className="emergency-card">
      <div className="emergency-card__sos-badge">
        <ShieldAlert size={20} />
        NOTFALL · EMERGENCY · URGENCE
      </div>

      <div className="emergency-card__name">
        {data.patient.firstName} {data.patient.lastName}
      </div>

      {data.bloodType && (
        <div className="emergency-card__block emergency-card__block--critical">
          <p className="emergency-card__block-title">Blood Type / Blutgruppe</p>
          <div className="emergency-card__blood-type">{data.bloodType}</div>
        </div>
      )}

      {criticalAllergies.length > 0 && (
        <div className="emergency-card__block emergency-card__block--critical">
          <p className="emergency-card__block-title">
            <AlertTriangle size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
            Critical Allergies / Kritische Allergien
          </p>
          {criticalAllergies.map((a, i) => (
            <div key={i} className="emergency-card__allergy-item">
              <span className={`emergency-card__severity-badge emergency-card__severity-badge--${a.severity}`}>
                {SEVERITY_LABELS[a.severity] || a.severity}
              </span>
              <span>
                {a.allergen}
                {a.reaction ? ` — ${a.reaction}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {otherAllergies.length > 0 && (
        <div className="emergency-card__block">
          <p className="emergency-card__block-title">Other Allergies</p>
          {otherAllergies.map((a, i) => (
            <div key={i} className="emergency-card__allergy-item">
              <span className={`emergency-card__severity-badge emergency-card__severity-badge--${a.severity}`}>
                {SEVERITY_LABELS[a.severity] || a.severity}
              </span>
              <span>
                {a.allergen}
                {a.reaction ? ` — ${a.reaction}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.diagnoses?.length > 0 && (
        <div className="emergency-card__block">
          <p className="emergency-card__block-title">Medical Conditions / Diagnosen</p>
          {data.diagnoses.map((d, i) => (
            <div key={i} style={{ marginBottom: "0.35rem" }}>
              {d.condition}
              {d.icdCode ? ` (${d.icdCode})` : ""}
            </div>
          ))}
        </div>
      )}

      {data.emergencyContacts?.length > 0 && (
        <div className="emergency-card__block">
          <p className="emergency-card__block-title">
            <Phone size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
            Emergency Contacts / Notfallkontakte
          </p>
          {data.emergencyContacts.map((c, i) => (
            <div key={i} className="emergency-card__contact">
              <strong>{c.name}</strong>{" "}
              <a href={`tel:${c.phone}`}>{c.phone}</a>
            </div>
          ))}
        </div>
      )}

      {data.firstResponderNote && (
        <div className="emergency-card__block">
          <p className="emergency-card__block-title">First Responder Note</p>
          <p className="emergency-card__ai-summary">{data.firstResponderNote}</p>
        </div>
      )}

      {data.aiSummary && (
        <div className="emergency-card__block">
          <p className="emergency-card__block-title">AI Medical Summary</p>
          <p className="emergency-card__ai-summary">{data.aiSummary}</p>
        </div>
      )}

      <div className="emergency-card__footer">
        This emergency card was created by the patient via MedScoutX. Information is self-reported
        and may not reflect the complete medical history. Consult medical records where possible.
      </div>
    </div>
  );
}
