import { useCallback, useEffect, useState } from "react";
import { Pill, Plus, Trash2 } from "lucide-react";
import {
  fetchPracticeMedications,
  savePracticeMedications,
} from "../api/visitMedicationsApi.js";
import "../styles/VisitMedications.css";

const EMPTY_ROW = () => ({
  drugName: "",
  dosage: "",
  frequency: "",
  intakeInstructions: "",
});

export default function VisitMedicationEditor({ sessionId, practiceId, t, canWrite }) {
  const [rows, setRows] = useState([EMPTY_ROW()]);
  const [notifyPatient, setNotifyPatient] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!sessionId || !practiceId) return;
    setLoading(true);
    setError("");
    try {
      const entries = await fetchPracticeMedications(sessionId, practiceId);
      if (entries.length > 0) {
        setRows(
          entries.map((e) => ({
            drugName: e.drugName || "",
            dosage: e.dosage || "",
            frequency: e.frequency || "",
            intakeInstructions: e.intakeInstructions || "",
          })),
        );
      } else {
        setRows([EMPTY_ROW()]);
      }
    } catch {
      setError(t.saveError);
    } finally {
      setLoading(false);
    }
  }, [sessionId, practiceId, t.saveError]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateRow(index, key, value) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, EMPTY_ROW()]);
  }

  function removeRow(index) {
    setRows((prev) => (prev.length <= 1 ? [EMPTY_ROW()] : prev.filter((_, i) => i !== index)));
  }

  async function save(publish) {
    if (!canWrite) return;
    const valid = rows.filter(
      (r) => r.drugName.trim() && r.frequency.trim(),
    );
    if (publish && valid.length === 0) {
      setError(t.validationDrug);
      return;
    }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await savePracticeMedications(sessionId, practiceId, {
        entries: valid,
        publish,
        notifyPatient: publish && notifyPatient,
      });
      setStatus(publish ? t.savedOk : t.savedDraft);
      await load();
    } catch {
      setError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="vm-status" role="status">
        …
      </p>
    );
  }

  return (
    <section
      className="vm-editor"
      aria-labelledby="vm-editor-title"
    >
      <header className="vm-editor__head">
        <Pill size={22} aria-hidden className="vm-editor__icon" />
        <div>
          <h2 id="vm-editor-title" className="vm-editor__title">
            {t.practiceSectionTitle}
          </h2>
          <p className="vm-editor__intro">{t.practiceSectionIntro}</p>
        </div>
      </header>

      <p className="vm-editor__safety" role="note">
        {t.practiceSafety}
      </p>

      {error ? (
        <p className="vm-alert vm-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="vm-alert vm-alert--ok" role="status">
          {status}
        </p>
      ) : null}

      <div className="vm-editor__rows">
        {rows.map((row, index) => (
          <fieldset key={index} className="vm-row">
            <legend className="vm-row__legend">
              {t.rowLabel.replace("{n}", String(index + 1))}
            </legend>
            <label className="vm-field">
              <span>{t.fieldDrug}</span>
              <input
                type="text"
                value={row.drugName}
                disabled={!canWrite}
                placeholder={t.placeholderDrug}
                onChange={(e) => updateRow(index, "drugName", e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="vm-field">
              <span>{t.fieldDosage}</span>
              <input
                type="text"
                value={row.dosage}
                disabled={!canWrite}
                placeholder={t.placeholderDosage}
                onChange={(e) => updateRow(index, "dosage", e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="vm-field">
              <span>{t.fieldFrequency}</span>
              <input
                type="text"
                value={row.frequency}
                disabled={!canWrite}
                placeholder={t.placeholderFrequency}
                onChange={(e) => updateRow(index, "frequency", e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="vm-field vm-field--full">
              <span>{t.fieldIntake}</span>
              <textarea
                rows={2}
                value={row.intakeInstructions}
                disabled={!canWrite}
                placeholder={t.placeholderIntake}
                onChange={(e) =>
                  updateRow(index, "intakeInstructions", e.target.value)
                }
              />
            </label>
            {canWrite && rows.length > 1 ? (
              <button
                type="button"
                className="vm-btn vm-btn--ghost"
                onClick={() => removeRow(index)}
              >
                <Trash2 size={16} aria-hidden />
                {t.removeRow}
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>

      {canWrite ? (
        <div className="vm-editor__actions">
          <button type="button" className="vm-btn vm-btn--ghost" onClick={addRow}>
            <Plus size={18} aria-hidden />
            {t.addRow}
          </button>
          <label className="vm-check">
            <input
              type="checkbox"
              checked={notifyPatient}
              onChange={(e) => setNotifyPatient(e.target.checked)}
            />
            <span>{t.notifyPatient}</span>
          </label>
          <div className="vm-editor__save-row">
            <button
              type="button"
              className="vm-btn vm-btn--secondary"
              disabled={saving}
              onClick={() => void save(false)}
            >
              {t.saveDraft}
            </button>
            <button
              type="button"
              className="vm-btn vm-btn--primary"
              disabled={saving}
              onClick={() => void save(true)}
            >
              {t.savePublish}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
