import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { suggestSeverity } from "../api/healthHistoryApi.js";
import "../styles/HealthHistory.css";

const TYPES = ["medication", "food", "environmental", "insect", "contact", "other"];
const SEVERITIES = ["mild", "moderate", "severe", "life_threatening"];
const STATUSES = ["active", "inactive", "uncertain"];

export default function AllergyForm({ initial, t, onSave, onCancel, saving }) {
  const [allergen, setAllergen] = useState(initial?.allergen || "");
  const [allergyType, setAllergyType] = useState(initial?.allergyType || "medication");
  const [severity, setSeverity] = useState(initial?.severity || "mild");
  const [reaction, setReaction] = useState(initial?.reaction || "");
  const [diagnosedDate, setDiagnosedDate] = useState(
    initial?.diagnosedDate ? initial.diagnosedDate.slice(0, 10) : ""
  );
  const [status, setStatus] = useState(initial?.status || "active");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const allergenRef = useRef(null);

  useEffect(() => {
    allergenRef.current?.focus();
  }, []);

  async function handleAiSuggest() {
    if (!reaction.trim() || reaction.trim().length < 3) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const { res, data } = await suggestSeverity(reaction.trim());
      if (res.ok && data.ok && data.severity) {
        setSeverity(data.severity);
        setAiResult(data.explanation || null);
      }
    } catch {
      // silent
    } finally {
      setAiLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!allergen.trim()) { setError(t?.errorAllergen || "Allergen eingeben"); return; }
    setError("");
    onSave({
      allergen: allergen.trim(),
      allergyType,
      severity,
      reaction: reaction.trim() || null,
      diagnosedDate: diagnosedDate || null,
      status,
      notes: notes.trim() || null,
    });
  }

  const s = t?.severities || {};
  const ty = t?.types || {};
  const st = t?.statuses || {};

  return (
    <div
      className="hh-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hh-allergy-form-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form className="hh-form-panel" onSubmit={handleSubmit} noValidate>
        <h2 id="hh-allergy-form-title" className="hh-form-panel__title">
          {initial ? (t?.editTitle || "Allergie bearbeiten") : (t?.addTitle || "Allergie hinzufügen")}
        </h2>

        {error && <p className="hh-form__error" role="alert">{error}</p>}

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-allergen">
            {t?.allergenLabel || "Allergen / Auslöser"} *
          </label>
          <input
            id="hh-allergen"
            ref={allergenRef}
            className="hh-form__input"
            value={allergen}
            onChange={(e) => setAllergen(e.target.value)}
            maxLength={200}
            placeholder={t?.allergenPlaceholder || "z.B. Penicillin, Nüsse, Bienenstich"}
            required
          />
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-allergy-type">
            {t?.typeLabel || "Typ"}
          </label>
          <select
            id="hh-allergy-type"
            className="hh-form__select"
            value={allergyType}
            onChange={(e) => setAllergyType(e.target.value)}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>{ty[type] || type}</option>
            ))}
          </select>
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-reaction">
            {t?.reactionLabel || "Reaktion / Symptome"}
          </label>
          <div className="hh-ai-row">
            <textarea
              id="hh-reaction"
              className="hh-form__textarea"
              value={reaction}
              onChange={(e) => setReaction(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t?.reactionPlaceholder || "Beschreibe die Symptome..."}
            />
            <button
              type="button"
              className="hh-ai-btn"
              onClick={handleAiSuggest}
              disabled={aiLoading || reaction.trim().length < 3}
              title={t?.aiSuggestSeverity || "KI: Schweregrad vorschlagen"}
              aria-label={t?.aiSuggestSeverity || "KI: Schweregrad vorschlagen"}
            >
              <Sparkles size={14} aria-hidden="true" />
              {aiLoading ? (t?.aiLoading || "…") : (t?.aiBtn || "KI")}
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
          <p className="hh-form__label">{t?.severityLabel || "Schweregrad"} *</p>
          <div className="hh-severity-grid" role="radiogroup" aria-label={t?.severityLabel || "Schweregrad"}>
            {SEVERITIES.map((sv) => (
              <label
                key={sv}
                className={`hh-severity-opt hh-severity-opt--${sv}${severity === sv ? " hh-severity-opt--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="severity"
                  value={sv}
                  checked={severity === sv}
                  onChange={() => setSeverity(sv)}
                />
                {s[sv] || sv}
              </label>
            ))}
          </div>
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-allergy-date">
            {t?.diagnosedDateLabel || "Diagnostiziert am"}
          </label>
          <input
            id="hh-allergy-date"
            type="date"
            className="hh-form__input"
            value={diagnosedDate}
            onChange={(e) => setDiagnosedDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-allergy-status">
            {t?.statusLabel || "Status"}
          </label>
          <select
            id="hh-allergy-status"
            className="hh-form__select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s_) => (
              <option key={s_} value={s_}>{st[s_] || s_}</option>
            ))}
          </select>
        </div>

        <div className="hh-form__group">
          <label className="hh-form__label" htmlFor="hh-allergy-notes">
            {t?.notesLabel || "Notizen"}
          </label>
          <textarea
            id="hh-allergy-notes"
            className="hh-form__textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t?.notesPlaceholder || "Weitere Hinweise..."}
          />
        </div>

        <div className="hh-form__actions">
          <button type="button" className="hh-form__cancel" onClick={onCancel}>
            {t?.cancel || "Abbrechen"}
          </button>
          <button type="submit" className="hh-form__submit" disabled={saving}>
            {saving ? (t?.saving || "Speichern…") : (t?.save || "Speichern")}
          </button>
        </div>
      </form>
    </div>
  );
}
