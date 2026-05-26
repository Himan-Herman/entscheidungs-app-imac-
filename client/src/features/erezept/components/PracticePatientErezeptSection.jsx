import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchPracticeErezept,
  createPracticeErezept,
  updatePracticeErezept,
  deletePracticeErezept,
} from "../api/practiceErezeptApi.js";
import ErezeptCard from "./ErezeptCard.jsx";
import ErezeptForm from "./ErezeptForm.jsx";
import "../styles/Erezept.css";

export default function PracticePatientErezeptSection({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.erezept || getMessages("en").erezept;
  }, [language]);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [noConsent, setNoConsent] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNoConsent(false);
    try {
      const { res, data } = await fetchPracticeErezept(linkId, practiceId);
      if (res.status === 403 && data.error === "consent_required") {
        setNoConsent(true);
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
      setLoadError(t?.loadingError || "Rezepte konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t]);

  useEffect(() => { load(); }, [load]);

  async function handleIssue(payload) {
    setSaving(true);
    try {
      const { res } = await createPracticeErezept(linkId, practiceId, payload);
      if (!res.ok) throw new Error("issue_failed");
      await load();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id) {
    setSaving(true);
    try {
      await updatePracticeErezept(linkId, practiceId, id, { status: "cancelled" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    try {
      await deletePracticeErezept(linkId, practiceId, id);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="erx-page__loading" aria-live="polite" aria-busy="true">
        <span className="erx-page__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (noConsent) {
    return (
      <div className="erx-page__empty">
        <FileText size={44} strokeWidth={1.5} aria-hidden="true" />
        <p>{t?.noConsent || "Patient hat den Zugriff auf Rezepte noch nicht freigegeben."}</p>
      </div>
    );
  }

  return (
    <section aria-label={t?.sectionHeading || "e-Rezepte"}>
      <h2 className="erx-section__heading">
        <FileText size={20} aria-hidden="true" />
        {t?.sectionHeading || "e-Rezepte"}
      </h2>
      <p className="erx-section__disclaimer">
        {t?.practiceDisclaimer || "Simulierte Rezeptverwaltung — keine echte Telematikinfrastruktur."}
      </p>

      <button className="erx-issue-btn" onClick={() => setShowForm(true)}>
        <Plus size={18} aria-hidden="true" />
        {t?.issueTitle || "e-Rezept ausstellen"}
      </button>

      {loadError && <div className="erx-page__error" role="alert">{loadError}</div>}

      {entries.length === 0 ? (
        <div className="erx-page__empty">
          <FileText size={40} strokeWidth={1.5} aria-hidden="true" />
          <p>{t?.noEntries || "Noch keine Rezepte ausgestellt."}</p>
        </div>
      ) : (
        <div className="erx-cards">
          {entries.map((entry) => (
            <ErezeptCard
              key={entry.id}
              entry={entry}
              t={t}
              onStatusUpdate={async (id, status) => {
                setSaving(true);
                await updatePracticeErezept(linkId, practiceId, id, { status });
                await load();
                setSaving(false);
              }}
              onDelete={handleCancel}
              readOnly={false}
              saving={saving}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ErezeptForm
          t={t}
          onSave={handleIssue}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}
    </section>
  );
}
