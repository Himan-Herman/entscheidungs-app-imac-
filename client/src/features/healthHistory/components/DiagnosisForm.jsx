import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { suggestIcd } from "../api/healthHistoryApi.js";
import "../styles/HealthHistory.css";

const STATUSES = ["active", "chronic", "resolved", "managed", "uncertain"];

export default function DiagnosisForm({ initial, t, onSave, onCancel, saving }) {
  const [conditionName, setConditionName] = useState(initial?.conditionName || "");
  const [icdCode, setIcdCode] = useState(initial?.icdCode || "");
  const [icdLabel, setIcdLabel] = useState("");
  const [diagnosedDate, setDiagnosedDate] = useState(
    initial?.diagnosedDate ? initial.diagnosedDate.slice(0, 10) : ""
  );
  const [status, setStatus] = useState(initial?.status || "active");
  const [treatingDoctor, setTreatingDoctor] = useState(initial?.treatingDoctor || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const conditionRef = useRef(null);

  useEffect(() => {
    conditionRef.current?.focus();
  }, []);

  async function handleAiSuggest() {
    if (!conditionName.trim() || conditionName.trim().length < 2) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const { res, data } = await suggestIcd(conditionName.trim());
      if (res.ok && data.ok) {
        if (data.icdCode) {
          setIcdCode(data.icdCode);
          setIcdLabel(data.icdLabel || "");
          setAiResult(`${data.icdCode}${data.icdLabel ? ` — ${data.icdLabel}` : ""}`);
        } else {
          setAiResult(t.aiNoCode);
        }
      }
    } catch {
      // silent
    } finally {
      setAiLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!conditionName.trim()) { setError(t.errorCondition); return; }
    setError("");
    onSave({
      conditionName: conditionName.trim(),
      icdCode: icdCode.trim() || null,
      diagnosedDate: diagnosedDate || null,
      status,
      treatingDoctor: treatingDoctor.trim() || null,
      notes: notes.trim() || null,
    });
  }

  const st = t?.statuses || {};

  return (
    <div
      className="hh-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hh-diagnosis-form-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form className="hh-form-panel" onSubmit={handleSubmit} noValidate>
        <h2 id="hh-diagnosis-form-title" className="hh-form-panel__title">
          {initial ? t.editTitle : t.addTitle}
        </h2>

        {error && <p className="hh-form__error" role="alert">{error}</p>}

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-condition">
            {t.conditionLabel} *
          </label>
          <div className="hh-ai-row">
            <input
              id="hh-condition"
              ref={conditionRef}
              className="hh-form__input"
              value={conditionName}
              onChange={(e) => setConditionName(e.target.value)}
              maxLength={300}
              placeholder={t.conditionPlaceholder}
              required
            />
            <button
              type="button"
              className="hh-ai-btn"
              onClick={handleAiSuggest}
              disabled={aiLoading || conditionName.trim().length < 2}
              title={t.aiSuggestIcd}
              aria-label={t.aiSuggestIcd}
            >
              <Sparkles size={14} aria-hidden="true" />
              {aiLoading ? t.aiLoading : "ICD"}
            </button>
          </div>
          {aiResult && (
            <div className="hh-ai-result" role="status" aria-live="polite">
              <Sparkles size={13} aria-hidden="true" />
              {aiResult}
            </div>
          )}
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-icd-code">
            {t.icdCodeLabel}
          </label>
          <input
            id="hh-icd-code"
            className="hh-form__input"
            value={icdCode}
            onChange={(e) => setIcdCode(e.target.value.toUpperCase())}
            maxLength={20}
            placeholder={t.icdCodePlaceholder}
            style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
          />
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-diag-status">
            {t.statusLabel}
          </label>
          <select
            id="hh-diag-status"
            className="hh-form__select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{st[s] || s}</option>
            ))}
          </select>
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-diag-date">
            {t.diagnosedDateLabel}
          </label>
          <input
            id="hh-diag-date"
            type="date"
            className="hh-form__input"
            value={diagnosedDate}
            onChange={(e) => setDiagnosedDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-doctor">
            {t.treatingDoctorLabel}
          </label>
          <input
            id="hh-doctor"
            className="hh-form__input"
            value={treatingDoctor}
            onChange={(e) => setTreatingDoctor(e.target.value)}
            maxLength={200}
            placeholder={t.treatingDoctorPlaceholder}
          />
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-diag-notes">
            {t.notesLabel}
          </label>
          <textarea
            id="hh-diag-notes"
            className="hh-form__textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t.notesPlaceholder}
          />
        </div>

        <div className="hh-form__actions">
          <button type="button" className="hh-form__cancel" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="submit" className="hh-form__submit" disabled={saving}>
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
