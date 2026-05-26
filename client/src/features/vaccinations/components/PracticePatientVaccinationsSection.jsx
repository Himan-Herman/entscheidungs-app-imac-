import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPracticePatientVaccinations } from "../api/practiceVaccinationsApi.js";
import VaccinationEntryCard from "./VaccinationEntryCard.jsx";
import "../styles/VaccinationPass.css";

export default function PracticePatientVaccinationsSection({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.vaccinations || getMessages("en").vaccinations;
  }, [language]);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [noConsent, setNoConsent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNoConsent(false);
    try {
      const { res, data } = await fetchPracticePatientVaccinations(linkId, practiceId);
      if (res.status === 403 && data.error === "consent_required") {
        setNoConsent(true);
        setEntries([]);
        return;
      }
      if (res.status === 404 && data.error === "feature_disabled") {
        setEntries([]);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setLoadError(t.loadingError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.loadingError]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = {};
    for (const e of entries) {
      const key = e.disease || "—";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  if (loading) {
    return (
      <div className="vacc-pass__loading" aria-live="polite" aria-busy="true">
        <span className="vacc-pass__loading-spinner" aria-hidden="true" />
      </div>
    );
  }

  if (noConsent) {
    return (
      <div className="vacc-pass__empty">
        <ShieldCheck size={40} strokeWidth={1.5} aria-hidden="true" />
        <p>{t.practice?.noConsent ?? "Der Patient hat den Zugriff auf den Impfpass noch nicht freigegeben."}</p>
      </div>
    );
  }

  if (loadError) {
    return <p className="vacc-pass__error" role="alert">{loadError}</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="vacc-pass__empty">
        <ShieldCheck size={40} strokeWidth={1.5} aria-hidden="true" />
        <p>{t.practice?.noEntries ?? t.noEntries}</p>
      </div>
    );
  }

  return (
    <main className="vacc-pass" aria-label={t.practice?.heading ?? t.pageHeading}>
      <div className="vacc-pass__header">
        <h2 className="vacc-pass__title">{t.practice?.heading ?? t.pageHeading}</h2>
        <p className="vacc-pass__disclaimer">{t.practice?.disclaimer ?? t.disclaimer}</p>
      </div>

      {grouped.map(([disease, group]) => (
        <section key={disease} className="vacc-pass__group" aria-label={disease}>
          <h3 className="vacc-pass__group-title">{disease}</h3>
          {group.map(entry => (
            <VaccinationEntryCard
              key={entry.id}
              entry={entry}
              t={t}
              lang={language}
              readOnly
            />
          ))}
        </section>
      ))}
    </main>
  );
}
