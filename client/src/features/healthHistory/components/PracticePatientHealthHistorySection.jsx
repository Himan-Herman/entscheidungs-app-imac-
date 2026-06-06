import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Sparkles, Stethoscope } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchPracticePatientHealthHistory,
  fetchPracticeHealthHistoryAiSummary,
} from "../api/practiceHealthHistoryApi.js";
import AllergyCard from "./AllergyCard.jsx";
import DiagnosisCard from "./DiagnosisCard.jsx";
import "../styles/HealthHistory.css";

export default function PracticePatientHealthHistorySection({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.healthHistory || getMessages("en").healthHistory;
  }, [language]);

  const [allergies, setAllergies] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [noConsent, setNoConsent] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiError, setAiError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNoConsent(false);
    try {
      const { res, data } = await fetchPracticePatientHealthHistory(linkId, practiceId);
      if (res.status === 403 && data.error === "consent_required") {
        setNoConsent(true);
        return;
      }
      if (res.status === 404 && data.error === "feature_disabled") {
        setAllergies([]);
        setDiagnoses([]);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setAllergies(Array.isArray(data.allergies) ? data.allergies : []);
      setDiagnoses(Array.isArray(data.diagnoses) ? data.diagnoses : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setLoadError(t?.loadingError || "Gesundheitsdaten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t]);

  useEffect(() => { load(); }, [load]);

  async function handleAiSummary() {
    setAiLoading(true);
    setAiError("");
    setAiSummary(null);
    try {
      const { res, data } = await fetchPracticeHealthHistoryAiSummary(linkId, practiceId, language);
      if (!res.ok || !data.ok) throw new Error("ai_unavailable");
      if (data.reason === "no_data") {
        setAiSummary(t?.practice?.aiNoData || "Keine Daten für eine Zusammenfassung vorhanden.");
      } else {
        setAiSummary(data.summary || "");
      }
    } catch {
      setAiError(t?.practice?.aiError || "Zusammenfassung nicht verfügbar.");
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="hh-page__loading" aria-live="polite" aria-busy="true">
        <span className="hh-page__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (noConsent) {
    return (
      <div className="hh-page__empty">
        <Stethoscope size={44} strokeWidth={1.5} aria-hidden="true" />
        <p>{t?.practice?.noConsent || "Der Patient hat den Zugriff auf Gesundheitsdaten noch nicht freigegeben."}</p>
      </div>
    );
  }

  const hasData = allergies.length > 0 || diagnoses.length > 0;

  return (
    <section className="hh-practice" aria-label={t?.practice?.heading || "Gesundheitsakte"}>
      <h2 className="hh-practice__heading">
        <Stethoscope size={20} aria-hidden="true" />
        {t?.practice?.heading || "Gesundheitsakte"}
      </h2>
      <p className="hh-practice__disclaimer">
        {t?.practice?.disclaimer || "Patientenseitig eingetragene Daten — kein offizieller Befund."}
      </p>

      {hasData && (
        <div className="hh-practice__ai-bar">
          <button
            className="hh-practice__ai-btn"
            onClick={handleAiSummary}
            disabled={aiLoading}
            aria-label={t?.practice?.aiSummaryBtn || "Risikozusammenfassung erstellen"}
          >
            <Sparkles size={15} aria-hidden="true" />
            {aiLoading
              ? (t?.aiLoading || "Analysiere…")
              : (t?.practice?.aiSummaryBtn || "Risikozusammenfassung")}
          </button>
          {aiError && <span style={{ color: "#dc2626", fontSize: "0.875rem" }}>{aiError}</span>}
        </div>
      )}

      {aiSummary && (
        <div className="hh-practice__ai-summary" aria-live="polite">
          {aiSummary}
        </div>
      )}

      {loadError && (
        <div className="hh-page__error" role="alert">{loadError}</div>
      )}

      {/* Allergies */}
      <h3 className="hh-practice__section-title">
        <AlertTriangle size={16} aria-hidden="true" />
        {t?.allergiesHeading || "Allergien"} ({allergies.length})
      </h3>
      {allergies.length === 0 ? (
        <p className="hh-page__empty" style={{ padding: "1rem 0" }}>
          <span>{t?.practice?.noAllergies || "Keine Allergien eingetragen."}</span>
        </p>
      ) : (
        <div className="hh-cards" style={{ marginBottom: "1.5rem" }}>
          {allergies.map((entry) => (
            <AllergyCard
              key={entry.id}
              entry={entry}
              t={t?.allergy}
              onEdit={() => {}}
              onDelete={() => {}}
              readOnly
            />
          ))}
        </div>
      )}

      {/* Diagnoses */}
      <h3 className="hh-practice__section-title">
        <Stethoscope size={16} aria-hidden="true" />
        {t?.diagnosesHeading || "Diagnosen"} ({diagnoses.length})
      </h3>
      {diagnoses.length === 0 ? (
        <p className="hh-page__empty" style={{ padding: "1rem 0" }}>
          <span>{t?.practice?.noDiagnoses || "Keine Diagnosen eingetragen."}</span>
        </p>
      ) : (
        <div className="hh-cards">
          {diagnoses.map((entry) => (
            <DiagnosisCard
              key={entry.id}
              entry={entry}
              t={t?.diagnosis}
              onEdit={() => {}}
              onDelete={() => {}}
              readOnly
            />
          ))}
        </div>
      )}
    </section>
  );
}
