import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Info, Plus, RotateCcw, Copy, Check, ArrowLeft } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { requestBillingExplanation } from "../api/patientBillingExplainApi.js";
import "../styles/PatientBillingExplain.css";

const MAX_ROWS = 30;
const MAX_TEXT_LENGTH = 5000;

function emptyRow() {
  return { ziffer: "", factor: "", count: "", amount: "", note: "" };
}

/** Map a server error code (or HTTP status) to an i18n key. */
function errorKeyFor(code, status) {
  if (status === 429) return "error_rateLimited";
  switch (code) {
    case "empty":
      return "error_empty";
    case "too_long":
      return "error_tooLong";
    case "too_many_rows":
      return "error_tooManyRows";
    default:
      return "error_generic";
  }
}

export default function PatientBillingExplainPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientBillingExplain ||
      getMessages("en").patientBillingExplain,
    [language],
  );

  const [mode, setMode] = useState("fields"); // 'fields' | 'text'
  const [rows, setRows] = useState([emptyRow()]);
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [openDraft, setOpenDraft] = useState(null); // 'practice' | 'insurer' | null
  const [copied, setCopied] = useState("");

  useEffect(() => {
    document.title = `${t.title} — MedScoutX`;
  }, [t.title]);

  const updateRow = useCallback((idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => (prev.length >= MAX_ROWS ? prev : [...prev, emptyRow()]));
  }, []);

  const removeRow = useCallback((idx) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }, []);

  const resetAll = useCallback(() => {
    setRows([emptyRow()]);
    setText("");
    setResult(null);
    setErrorKey("");
    setOpenDraft(null);
  }, []);

  const onExplain = useCallback(async () => {
    setErrorKey("");
    setResult(null);

    const filledRows = rows
      .map((r) => ({
        ziffer: r.ziffer.trim(),
        factor: r.factor.trim(),
        count: r.count.trim(),
        amount: r.amount.trim(),
        note: r.note.trim(),
      }))
      .filter((r) => r.ziffer || r.factor || r.count || r.amount || r.note);

    const payload =
      mode === "text" ? { text } : { rows: filledRows };

    // Light client-side guard to avoid an empty round-trip.
    if (mode === "text" ? !text.trim() : filledRows.length === 0) {
      setErrorKey("error_empty");
      return;
    }

    setLoading(true);
    try {
      const { res, data } = await requestBillingExplanation(payload);
      if (!res.ok || !data.ok) {
        setErrorKey(t[errorKeyFor(data.error, res.status)] ? errorKeyFor(data.error, res.status) : "error_generic");
        return;
      }
      setResult(data);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setErrorKey("error_generic");
    } finally {
      setLoading(false);
    }
  }, [mode, rows, text, t]);

  const copyDraft = useCallback(
    async (which) => {
      const subject = which === "practice" ? t.draftPractice_subject : t.draftInsurer_subject;
      const body = which === "practice" ? t.draftPractice_body : t.draftInsurer_body;
      const full = `${subject}\n\n${body}`;
      try {
        await navigator.clipboard.writeText(full);
        setCopied(which);
        window.setTimeout(() => setCopied(""), 2000);
      } catch {
        /* clipboard unavailable — user can still select the text manually */
      }
    },
    [t],
  );

  const items = result?.items ?? [];

  return (
    <div className="billing-explain">
      <Link className="billing-explain__back" to="/patient/practice-documents">
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> {t.backToDocuments}
      </Link>

      <header className="billing-explain__header">
        <h1 className="billing-explain__title">{t.title}</h1>
        <p className="billing-explain__subtitle">{t.subtitle}</p>
        <p className="billing-explain__lead">{t.shortDescription}</p>
      </header>

      <div className="billing-explain__disclaimer" role="note">
        <Info size={18} strokeWidth={2} aria-hidden="true" className="billing-explain__disclaimer-icon" />
        <span>{t.disclaimerBanner}</span>
      </div>

      <p className="billing-explain__privacy" role="note">
        {t.privacyNote}
      </p>

      <div className="billing-explain__mode" role="tablist" aria-label={t.title}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "fields"}
          className={`billing-explain__mode-btn${mode === "fields" ? " is-active" : ""}`}
          onClick={() => setMode("fields")}
        >
          {t.inputModeFields}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "text"}
          className={`billing-explain__mode-btn${mode === "text" ? " is-active" : ""}`}
          onClick={() => setMode("text")}
        >
          {t.inputModeText}
        </button>
      </div>

      {mode === "fields" ? (
        <section className="billing-explain__form" aria-label={t.inputModeFields}>
          {rows.map((row, idx) => (
            <div className="billing-explain__row" key={idx}>
              <div className="billing-explain__field">
                <label className="billing-explain__label" htmlFor={`ziffer-${idx}`}>
                  {t.fieldZiffer}
                </label>
                <input
                  id={`ziffer-${idx}`}
                  className="billing-explain__input"
                  type="text"
                  inputMode="numeric"
                  value={row.ziffer}
                  placeholder={t.fieldZifferPlaceholder}
                  onChange={(e) => updateRow(idx, "ziffer", e.target.value)}
                />
              </div>
              <div className="billing-explain__field">
                <label className="billing-explain__label" htmlFor={`factor-${idx}`}>
                  {t.fieldFactor}
                </label>
                <input
                  id={`factor-${idx}`}
                  className="billing-explain__input"
                  type="text"
                  inputMode="decimal"
                  value={row.factor}
                  placeholder={t.fieldFactorPlaceholder}
                  onChange={(e) => updateRow(idx, "factor", e.target.value)}
                />
              </div>
              <div className="billing-explain__field">
                <label className="billing-explain__label" htmlFor={`count-${idx}`}>
                  {t.fieldCount}
                </label>
                <input
                  id={`count-${idx}`}
                  className="billing-explain__input"
                  type="text"
                  inputMode="numeric"
                  value={row.count}
                  placeholder={t.fieldCountPlaceholder}
                  onChange={(e) => updateRow(idx, "count", e.target.value)}
                />
              </div>
              <div className="billing-explain__field">
                <label className="billing-explain__label" htmlFor={`amount-${idx}`}>
                  {t.fieldAmount}
                </label>
                <input
                  id={`amount-${idx}`}
                  className="billing-explain__input"
                  type="text"
                  inputMode="decimal"
                  value={row.amount}
                  placeholder={t.fieldAmountPlaceholder}
                  onChange={(e) => updateRow(idx, "amount", e.target.value)}
                />
              </div>
              <div className="billing-explain__field billing-explain__field--note">
                <label className="billing-explain__label" htmlFor={`note-${idx}`}>
                  {t.fieldNote}
                </label>
                <input
                  id={`note-${idx}`}
                  className="billing-explain__input"
                  type="text"
                  value={row.note}
                  placeholder={t.fieldNotePlaceholder}
                  onChange={(e) => updateRow(idx, "note", e.target.value)}
                />
              </div>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="billing-explain__row-remove"
                  onClick={() => removeRow(idx)}
                  aria-label={`${t.fieldZiffer} ${idx + 1} — ${t.btnReset}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}

          <div className="billing-explain__form-actions">
            <button
              type="button"
              className="billing-explain__btn billing-explain__btn--secondary"
              onClick={addRow}
              disabled={rows.length >= MAX_ROWS}
            >
              <Plus size={16} strokeWidth={2} aria-hidden="true" /> {t.btnAddRow}
            </button>
          </div>
        </section>
      ) : (
        <section className="billing-explain__form" aria-label={t.inputModeText}>
          <div className="billing-explain__field">
            <label className="billing-explain__label" htmlFor="invoice-text">
              {t.pasteInvoiceLabel}
            </label>
            <textarea
              id="invoice-text"
              className="billing-explain__textarea"
              value={text}
              maxLength={MAX_TEXT_LENGTH}
              placeholder={t.pasteInvoicePlaceholder}
              onChange={(e) => setText(e.target.value)}
              rows={8}
            />
          </div>
        </section>
      )}

      <div className="billing-explain__actions">
        <button
          type="button"
          className="billing-explain__btn billing-explain__btn--primary"
          onClick={onExplain}
          disabled={loading}
        >
          {t.btnExplain}
        </button>
        <button
          type="button"
          className="billing-explain__btn billing-explain__btn--secondary"
          onClick={resetAll}
          disabled={loading}
        >
          <RotateCcw size={16} strokeWidth={2} aria-hidden="true" /> {t.btnReset}
        </button>
      </div>

      {errorKey ? (
        <p className="billing-explain__status billing-explain__status--error" role="alert">
          {t[errorKey] || t.error_generic}
        </p>
      ) : null}

      {result ? (
        <section className="billing-explain__result" aria-live="polite">
          <h2 className="billing-explain__result-heading">{t.resultHeading}</h2>
          <p className="billing-explain__result-note" role="note">
            {t.resultNote}
          </p>

          {result.personalDataNotice ? (
            <p className="billing-explain__status billing-explain__status--warn" role="note">
              {t.error_personalData}
            </p>
          ) : null}

          <ul className="billing-explain__items">
            {items.map((item, idx) => (
              <li className="billing-explain__item" key={idx}>
                <div className="billing-explain__item-head">
                  <span className="billing-explain__item-ziffer">{item.ziffer || "—"}</span>
                  {item.found ? (
                    item.title ? (
                      <span className="billing-explain__item-title">{item.title}</span>
                    ) : null
                  ) : (
                    <span className="billing-explain__item-badge">{t.catalogUnknownLabel}</span>
                  )}
                </div>
                {(item.factor || item.count || item.amount) ? (
                  <p className="billing-explain__item-meta">
                    {[
                      item.factor ? `${t.fieldFactor}: ${item.factor}` : null,
                      item.count ? `${t.fieldCount}: ${item.count}` : null,
                      item.amount ? `${t.fieldAmount.replace(" (optional)", "")}: ${item.amount}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {item.warnings && item.warnings.length > 0 ? (
                  <ul className="billing-explain__item-warnings">
                    {item.warnings.map((code) => (
                      <li className="billing-explain__item-warning" key={code}>
                        {t[`warn_${code}`] || code}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>

          {result.noFindings ? (
            <p className="billing-explain__no-findings" role="note">
              {t.result_noFindings}
            </p>
          ) : null}

          <div className="billing-explain__drafts">
            <div className="billing-explain__draft-actions">
              <button
                type="button"
                className="billing-explain__btn billing-explain__btn--secondary"
                onClick={() => setOpenDraft(openDraft === "practice" ? null : "practice")}
                aria-expanded={openDraft === "practice"}
              >
                {t.btnDraftPractice}
              </button>
              <button
                type="button"
                className="billing-explain__btn billing-explain__btn--secondary"
                onClick={() => setOpenDraft(openDraft === "insurer" ? null : "insurer")}
                aria-expanded={openDraft === "insurer"}
              >
                {t.btnDraftInsurer}
              </button>
            </div>

            {openDraft ? (
              <div className="billing-explain__draft">
                <label className="billing-explain__label" htmlFor="draft-text">
                  {openDraft === "practice" ? t.draftPractice_subject : t.draftInsurer_subject}
                </label>
                <textarea
                  id="draft-text"
                  className="billing-explain__textarea"
                  readOnly
                  rows={10}
                  value={openDraft === "practice" ? t.draftPractice_body : t.draftInsurer_body}
                />
                <button
                  type="button"
                  className="billing-explain__btn billing-explain__btn--secondary"
                  onClick={() => copyDraft(openDraft)}
                >
                  {copied === openDraft ? (
                    <>
                      <Check size={16} strokeWidth={2} aria-hidden="true" /> {t.btnCopied}
                    </>
                  ) : (
                    <>
                      <Copy size={16} strokeWidth={2} aria-hidden="true" /> {t.btnCopy}
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <p className="billing-explain__footer" role="note">
        {t.footerNote}
      </p>
    </div>
  );
}
