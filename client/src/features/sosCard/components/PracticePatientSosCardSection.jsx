import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import SosCardPreview from "./SosCardPreview.jsx";
import "../styles/SosCard.css";

/**
 * Read-only SOS card tab inside the practice patient detail view.
 * @param {{ linkId: string; practiceId: string }} props
 */
export default function PracticePatientSosCardSection({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.sosCard || getMessages("en").sosCard;
  }, [language]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [card, setCard] = useState(null);
  const [referenced, setReferenced] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(
        `/api/practice/patients/${encodeURIComponent(linkId)}/sos-card?practiceId=${encodeURIComponent(practiceId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 404 && data.error === "feature_disabled") {
        setCard(null);
        setError("");
        return;
      }
      if (res.status === 403 && data.error === "no_consent") {
        setError("no_consent");
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setCard(data.card || null);
      setReferenced({
        age: data.age ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        heightCm: data.heightCm ?? null,
        weightKg: data.weightKg ?? null,
      });
      setAllergies(Array.isArray(data.allergies) ? data.allergies : []);
      setDiagnoses(Array.isArray(data.diagnoses) ? data.diagnoses : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p style={{ color: "#9ca3af" }}>{t?.loading || "Laden…"}</p>;

  if (error === "no_consent") {
    return (
      <div className="sos-card__section">
        <p className="sos-card__subtitle">{t?.practice?.noConsent}</p>
      </div>
    );
  }

  if (error) {
    return <p className="sos-card__error">{t?.loadError}</p>;
  }

  return (
    <div>
      <div className="sos-card__disclaimer">{t?.practice?.disclaimer}</div>
      {!card && !allergies.length ? (
        <p style={{ color: "#9ca3af", fontStyle: "italic" }}>{t?.practice?.noCard}</p>
      ) : (
        <SosCardPreview
          card={card}
          referenced={referenced}
          allergies={allergies}
          diagnoses={diagnoses}
          respectVisibility={false}
          t={t}
        />
      )}
    </div>
  );
}
