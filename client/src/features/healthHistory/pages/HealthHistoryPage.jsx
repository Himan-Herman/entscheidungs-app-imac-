import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, ShieldAlert, Stethoscope } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchAllergies, createAllergy, updateAllergy, deleteAllergy,
  fetchDiagnoses, createDiagnosis, updateDiagnosis, deleteDiagnosis,
} from "../api/healthHistoryApi.js";
import AllergyCard from "../components/AllergyCard.jsx";
import AllergyForm from "../components/AllergyForm.jsx";
import DiagnosisCard from "../components/DiagnosisCard.jsx";
import DiagnosisForm from "../components/DiagnosisForm.jsx";
import "../styles/HealthHistory.css";

export default function HealthHistoryPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.healthHistory || getMessages("en").healthHistory;
  }, [language]);

  const [activeTab, setActiveTab] = useState("allergies");

  // Allergies state
  const [allergies, setAllergies] = useState([]);
  const [allergyLoading, setAllergyLoading] = useState(true);
  const [allergyError, setAllergyError] = useState("");
  const [showAllergyForm, setShowAllergyForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [savingAllergy, setSavingAllergy] = useState(false);

  // Diagnoses state
  const [diagnoses, setDiagnoses] = useState([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(true);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState(null);
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);

  useEffect(() => {
    if (t?.pageTitle) document.title = t.pageTitle;
  }, [t]);

  const loadAllergies = useCallback(async () => {
    setAllergyLoading(true);
    setAllergyError("");
    try {
      const { res, data } = await fetchAllergies();
      if (res.status === 404 && data.error === "feature_disabled") { setAllergies([]); return; }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setAllergies(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setAllergyError(t?.loadingError || "Laden fehlgeschlagen.");
    } finally {
      setAllergyLoading(false);
    }
  }, [t]);

  const loadDiagnoses = useCallback(async () => {
    setDiagnosisLoading(true);
    setDiagnosisError("");
    try {
      const { res, data } = await fetchDiagnoses();
      if (res.status === 404 && data.error === "feature_disabled") { setDiagnoses([]); return; }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setDiagnoses(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setDiagnosisError(t?.loadingError || "Laden fehlgeschlagen.");
    } finally {
      setDiagnosisLoading(false);
    }
  }, [t]);

  useEffect(() => { loadAllergies(); loadDiagnoses(); }, [loadAllergies, loadDiagnoses]);

  // ── Allergy handlers ──────────────────────────────────────────────────────
  async function handleAllergySubmit(payload) {
    setSavingAllergy(true);
    try {
      if (editingAllergy) {
        const { res } = await updateAllergy(editingAllergy.id, payload);
        if (!res.ok) throw new Error("save_failed");
      } else {
        const { res } = await createAllergy(payload);
        if (!res.ok) throw new Error("save_failed");
      }
      await loadAllergies();
      setShowAllergyForm(false);
      setEditingAllergy(null);
    } finally {
      setSavingAllergy(false);
    }
  }

  async function handleAllergyDelete(id) {
    const { res } = await deleteAllergy(id);
    if (res.ok) await loadAllergies();
  }

  function openEditAllergy(entry) {
    setEditingAllergy(entry);
    setShowAllergyForm(true);
  }
  function openAddAllergy() {
    setEditingAllergy(null);
    setShowAllergyForm(true);
  }
  function closeAllergyForm() {
    setShowAllergyForm(false);
    setEditingAllergy(null);
  }

  // ── Diagnosis handlers ────────────────────────────────────────────────────
  async function handleDiagnosisSubmit(payload) {
    setSavingDiagnosis(true);
    try {
      if (editingDiagnosis) {
        const { res } = await updateDiagnosis(editingDiagnosis.id, payload);
        if (!res.ok) throw new Error("save_failed");
      } else {
        const { res } = await createDiagnosis(payload);
        if (!res.ok) throw new Error("save_failed");
      }
      await loadDiagnoses();
      setShowDiagnosisForm(false);
      setEditingDiagnosis(null);
    } finally {
      setSavingDiagnosis(false);
    }
  }

  async function handleDiagnosisDelete(id) {
    const { res } = await deleteDiagnosis(id);
    if (res.ok) await loadDiagnoses();
  }

  function openEditDiagnosis(entry) {
    setEditingDiagnosis(entry);
    setShowDiagnosisForm(true);
  }
  function openAddDiagnosis() {
    setEditingDiagnosis(null);
    setShowDiagnosisForm(true);
  }
  function closeDiagnosisForm() {
    setShowDiagnosisForm(false);
    setEditingDiagnosis(null);
  }

  return (
    <main className="hh-page" aria-label={t?.pageHeading || "Gesundheitsakte"}>
      {/* Header */}
      <header className="hh-page__header">
        <h1 className="hh-page__title">{t?.pageHeading || "Meine Gesundheitsakte"}</h1>
        <p className="hh-page__intro">{t?.intro || "Allergien und Diagnosen persönlich dokumentieren."}</p>
        <p className="hh-page__disclaimer">{t?.disclaimer || "Persönliche Übersicht – kein offizieller Befund."}</p>
      </header>

      {/* Tabs */}
      <nav className="hh-tabs" aria-label={t?.tabsLabel || "Bereiche"} role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "allergies"}
          aria-controls="hh-panel-allergies"
          id="hh-tab-allergies"
          className={`hh-tabs__btn${activeTab === "allergies" ? " hh-tabs__btn--active" : ""}`}
          onClick={() => setActiveTab("allergies")}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          {t?.allergiesHeading || "Allergien"}
          <span className="hh-tabs__count">{allergies.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "diagnoses"}
          aria-controls="hh-panel-diagnoses"
          id="hh-tab-diagnoses"
          className={`hh-tabs__btn${activeTab === "diagnoses" ? " hh-tabs__btn--active" : ""}`}
          onClick={() => setActiveTab("diagnoses")}
        >
          <Stethoscope size={16} aria-hidden="true" />
          {t?.diagnosesHeading || "Diagnosen"}
          <span className="hh-tabs__count">{diagnoses.length}</span>
        </button>
      </nav>

      {/* ── Allergies panel ─────────────────────────────────────────────────── */}
      <div
        id="hh-panel-allergies"
        role="tabpanel"
        aria-labelledby="hh-tab-allergies"
        hidden={activeTab !== "allergies"}
      >
        <button className="hh-section__add-btn" onClick={openAddAllergy}>
          <Plus size={18} aria-hidden="true" />
          {t?.allergy?.addTitle || "Allergie hinzufügen"}
        </button>

        {allergyError && <div className="hh-page__error" role="alert">{allergyError}</div>}

        {allergyLoading ? (
          <div className="hh-page__loading" aria-live="polite" aria-busy="true">
            <span className="hh-page__spinner" aria-hidden="true" />
          </div>
        ) : allergies.length === 0 ? (
          <div className="hh-page__empty">
            <ShieldAlert size={44} strokeWidth={1.5} aria-hidden="true" />
            <p>{t?.allergy?.noEntries || "Noch keine Allergien eingetragen."}</p>
            <p style={{ fontSize: "0.875rem" }}>{t?.allergy?.noEntriesHint || "Füge deine erste Allergie hinzu."}</p>
          </div>
        ) : (
          <div className="hh-cards">
            {allergies.map((entry) => (
              <AllergyCard
                key={entry.id}
                entry={entry}
                t={t?.allergy}
                onEdit={openEditAllergy}
                onDelete={handleAllergyDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Diagnoses panel ─────────────────────────────────────────────────── */}
      <div
        id="hh-panel-diagnoses"
        role="tabpanel"
        aria-labelledby="hh-tab-diagnoses"
        hidden={activeTab !== "diagnoses"}
      >
        <button className="hh-section__add-btn" onClick={openAddDiagnosis}>
          <Plus size={18} aria-hidden="true" />
          {t?.diagnosis?.addTitle || "Diagnose hinzufügen"}
        </button>

        {diagnosisError && <div className="hh-page__error" role="alert">{diagnosisError}</div>}

        {diagnosisLoading ? (
          <div className="hh-page__loading" aria-live="polite" aria-busy="true">
            <span className="hh-page__spinner" aria-hidden="true" />
          </div>
        ) : diagnoses.length === 0 ? (
          <div className="hh-page__empty">
            <Stethoscope size={44} strokeWidth={1.5} aria-hidden="true" />
            <p>{t?.diagnosis?.noEntries || "Noch keine Diagnosen eingetragen."}</p>
            <p style={{ fontSize: "0.875rem" }}>{t?.diagnosis?.noEntriesHint || "Füge deine erste Diagnose hinzu."}</p>
          </div>
        ) : (
          <div className="hh-cards">
            {diagnoses.map((entry) => (
              <DiagnosisCard
                key={entry.id}
                entry={entry}
                t={t?.diagnosis}
                onEdit={openEditDiagnosis}
                onDelete={handleDiagnosisDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Forms */}
      {showAllergyForm && (
        <AllergyForm
          initial={editingAllergy}
          t={t?.allergy}
          onSave={handleAllergySubmit}
          onCancel={closeAllergyForm}
          saving={savingAllergy}
        />
      )}
      {showDiagnosisForm && (
        <DiagnosisForm
          initial={editingDiagnosis}
          t={t?.diagnosis}
          onSave={handleDiagnosisSubmit}
          onCancel={closeDiagnosisForm}
          saving={savingDiagnosis}
        />
      )}
    </main>
  );
}
