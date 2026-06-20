import { useCallback, useEffect, useState } from "react";
import { Plus, NotebookPen } from "lucide-react";
import {
  fetchSymptoms, createSymptom, updateSymptom, deleteSymptom,
} from "../api/symptomDiaryApi.js";
import { noteSymptomDiaryDisabledResponse } from "../featureFlag.js";
import SymptomCard from "./SymptomCard.jsx";
import SymptomForm from "./SymptomForm.jsx";
import "../styles/SymptomDiary.css";

/**
 * Self-contained symptom diary section, rendered inside the health-record "Symptom history"
 * tab. Manages its own loading/CRUD state. Documentation only — no diagnosis/therapy/triage.
 */
export default function SymptomDiarySection({ t, locale, onCountChange }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchSymptoms();
      noteSymptomDiaryDisabledResponse(res, data);
      if (res.status === 404 && data.error === "feature_disabled") { setEntries([]); return; }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      const list = Array.isArray(data.entries) ? data.entries : [];
      setEntries(list);
      onCountChange?.(list.length);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(t.loadingError);
    } finally {
      setLoading(false);
    }
  }, [t.loadingError, onCountChange]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(payload) {
    setSaving(true);
    try {
      const { res } = editing
        ? await updateSymptom(editing.id, payload)
        : await createSymptom(payload);
      if (!res.ok) throw new Error("save_failed");
      await load();
      setShowForm(false);
      setEditing(null);
    } catch {
      setError(t.error_generic);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const { res } = await deleteSymptom(id);
    if (res.ok) await load();
  }

  return (
    <div>
      <p className="sd-privacy" role="note">{t.privacyNote}</p>

      <button
        className="sd-add-btn"
        onClick={() => { setEditing(null); setShowForm(true); }}
      >
        <Plus size={18} aria-hidden="true" />
        {t.addBtn}
      </button>

      {error && <div className="sd-error" role="alert">{error}</div>}

      {loading ? (
        <div className="sd-loading" aria-live="polite" aria-busy="true">{t.loading}</div>
      ) : entries.length === 0 ? (
        <div className="sd-empty">
          <NotebookPen size={40} strokeWidth={1.5} aria-hidden="true" />
          <p>{t.empty}</p>
          <p style={{ fontSize: "0.85rem" }}>{t.emptyHint}</p>
        </div>
      ) : (
        <div className="sd-cards">
          {entries.map((entry) => (
            <SymptomCard
              key={entry.id}
              entry={entry}
              t={t}
              locale={locale}
              onEdit={(e) => { setEditing(e); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <SymptomForm
          initial={editing}
          t={t}
          saving={saving}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
