import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  createVaccination,
  deleteVaccination,
  deleteVaccinationDocument,
  fetchVaccinations,
  updateVaccination,
  uploadVaccinationDocument,
} from "../api/vaccinationsApi.js";
import VaccinationEntryCard from "../components/VaccinationEntryCard.jsx";
import VaccinationEntryForm from "../components/VaccinationEntryForm.jsx";
import "../styles/VaccinationPass.css";

export default function VaccinationPassPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.vaccinations || getMessages("en").vaccinations;
  }, [language]);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (t?.pageTitle) document.title = t.pageTitle;
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { res, data } = await fetchVaccinations();
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
  }, [t.loadingError]);

  useEffect(() => { load(); }, [load]);

  async function handleSave({ fields, file, keepExistingDoc }) {
    setSaving(true);
    try {
      let result;
      if (editing) {
        const { res, data } = await updateVaccination(editing.id, {
          vaccineName: fields.vaccineName.trim(),
          disease: fields.disease.trim(),
          vaccinationDate: fields.vaccinationDate,
          doseLabel: fields.doseLabel.trim() || null,
          lotNumber: fields.lotNumber.trim() || null,
          location: fields.location.trim() || null,
          nextDueDate: fields.nextDueDate || null,
          notes: fields.notes.trim() || null,
          removeDocument: editing.documentKey && !keepExistingDoc && !file,
        });
        if (!res.ok) throw new Error("save_failed");
        result = data.entry;
        if (!keepExistingDoc && !file && editing.documentKey) {
          await deleteVaccinationDocument(editing.id).catch(() => {});
        }
      } else {
        const { res, data } = await createVaccination({
          vaccineName: fields.vaccineName.trim(),
          disease: fields.disease.trim(),
          vaccinationDate: fields.vaccinationDate,
          doseLabel: fields.doseLabel.trim() || null,
          lotNumber: fields.lotNumber.trim() || null,
          location: fields.location.trim() || null,
          nextDueDate: fields.nextDueDate || null,
          notes: fields.notes.trim() || null,
        });
        if (!res.ok) throw new Error("save_failed");
        result = data.entry;
      }

      if (file && result?.id) {
        await uploadVaccinationDocument(result.id, file).catch(() => {});
      }

      await load();
      setShowForm(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const { res } = await deleteVaccination(id);
    if (!res.ok) throw new Error("delete_failed");
    await load();
  }

  function openEdit(entry) {
    setEditing(entry);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAdd() {
    setEditing(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  const grouped = useMemo(() => {
    const map = {};
    for (const e of entries) {
      const key = e.disease || "—";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  return (
    <main className="vacc-pass" aria-label={t.pageHeading}>
      <div className="vacc-pass__header">
        <h1 className="vacc-pass__title">{t.pageHeading}</h1>
        <p className="vacc-pass__intro">{t.intro}</p>
        <p className="vacc-pass__disclaimer">{t.disclaimer}</p>
      </div>

      {!showForm && (
        <button
          type="button"
          className="vacc-pass__add-btn"
          onClick={openAdd}
          aria-label={t.addEntry}
        >
          <Plus size={18} aria-hidden="true" />
          {t.addEntry}
        </button>
      )}

      {showForm && (
        <VaccinationEntryForm
          t={t}
          initial={editing}
          onSave={handleSave}
          onCancel={closeForm}
          saving={saving}
        />
      )}

      {loadError && (
        <p className="vacc-pass__error" role="alert">{loadError}</p>
      )}

      {loading && (
        <div className="vacc-pass__loading" aria-live="polite" aria-busy="true">
          <span className="vacc-pass__loading-spinner" aria-hidden="true" />
        </div>
      )}

      {!loading && !loadError && entries.length === 0 && !showForm && (
        <div className="vacc-pass__empty">
          <ShieldCheck size={40} strokeWidth={1.5} aria-hidden="true" />
          <p>{t.noEntries}</p>
          <p className="vacc-pass__empty-hint">{t.noEntriesHint}</p>
        </div>
      )}

      {!loading && grouped.map(([disease, group]) => (
        <section key={disease} className="vacc-pass__group" aria-label={disease}>
          <h2 className="vacc-pass__group-title">{disease}</h2>
          {group.map(entry => (
            <VaccinationEntryCard
              key={entry.id}
              entry={entry}
              t={t}
              lang={language}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </section>
      ))}
    </main>
  );
}
