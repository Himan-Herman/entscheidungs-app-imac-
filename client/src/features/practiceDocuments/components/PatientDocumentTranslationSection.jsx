import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";

import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { translatePracticeDocument } from "../api/documentTranslationApi.js";
import { isDocumentTranslationClientEnabled } from "../translation/documentTranslationFeatureFlag.js";
import {
  TRANSLATION_MODES,
  defaultSelectedFileId,
  evaluateSubmitState,
  getTranslationTargetLanguages,
  isSameLanguageStrictRequest,
  isTranslatableDocument,
  selectableFiles,
} from "../translation/documentTranslationOptions.js";
import {
  isRetryableError,
  isUnavailableState,
  translationErrorKey,
} from "../translation/documentTranslationErrors.js";
import {
  canExportPdfForLanguage,
  generateTranslationPdf,
} from "../pdf/generateTranslationPdf.js";
import "../styles/DocumentTranslationSection.css";

/**
 * Translate / plain-language section on a practice document's detail page.
 *
 * ── What this component is not ──────────────────────────────────────────────
 * It is not an explainer, an analyser or an assistant. Mode A moves the text
 * into another language; mode B rewords the text that is already there. Neither
 * adds medical information, and the wording throughout avoids implying it does.
 *
 * ── Result handling ─────────────────────────────────────────────────────────
 * The result lives in component state and nowhere else — no storage, no cache,
 * no query client. The server does not persist it either, so a reload genuinely
 * has nothing to restore, and pretending otherwise would be showing a patient a
 * medical document that no longer has a source.
 *
 * ── Rendering ───────────────────────────────────────────────────────────────
 * Model-derived text is rendered as text nodes only. No dangerouslySetInnerHTML,
 * no markdown renderer, no auto-linking: a transformation result is content to
 * display, never markup to execute.
 */
export default function PatientDocumentTranslationSection({ document, onViewOriginal }) {
  const { language } = useLanguage();

  const t = useMemo(() => {
    const messages = getMessages(language).patientPracticeDocuments;
    const fallback = getMessages("en").patientPracticeDocuments;
    return messages?.translation ?? fallback?.translation ?? {};
  }, [language]);

  const files = useMemo(() => selectableFiles(document), [document]);
  const targetLanguages = useMemo(() => getTranslationTargetLanguages(), []);

  const [fileId, setFileId] = useState(() => defaultSelectedFileId(document));
  const [mode, setMode] = useState(TRANSLATION_MODES.STRICT);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [errorCode, setErrorCode] = useState("");
  const [pdfError, setPdfError] = useState(false);

  const abortRef = useRef(null);

  /**
   * Clear anything on screen that describes an earlier request.
   *
   * The controls and the result have to agree. Leaving an English translation
   * visible while the target-language control reads "Русский" invites a patient
   * to read the wrong document as the one they just asked for — the metadata
   * names the language, but the form should not contradict it in the first
   * place.
   */
  const clearOutput = useCallback(() => {
    setResult(null);
    setErrorCode("");
    setPdfError(false);
  }, []);

  const documentId = document?.id ?? "";
  const initialFileId = useMemo(() => defaultSelectedFileId(document), [document]);

  // A different document means a different result. Keeping the old one on
  // screen would attach one letter's transformation to another's header.
  // Keyed on the id rather than the object so an unrelated re-render does not
  // discard a result the patient is reading.
  useEffect(() => {
    setFileId(initialFileId);
    clearOutput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Abort an in-flight request when the component goes away, so a request the
  // patient can no longer see does not keep a provider call alive.
  useEffect(() => () => abortRef.current?.abort(), []);

  const submitState = evaluateSubmitState({ document, fileId, mode, targetLanguage, busy });
  const sameLanguageStrict = isSameLanguageStrictRequest(mode, targetLanguage);

  const run = useCallback(async () => {
    if (!submitState.canSubmit) return;

    // Replaces any in-flight request rather than running two at once. The
    // server also allows only one transformation per patient at a time.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    clearOutput();

    try {
      const { res, data } = await translatePracticeDocument({
        documentId,
        fileId,
        targetLanguage,
        mode,
        signal: controller.signal,
      });

      if (!res.ok || !data?.ok) {
        setErrorCode(String(data?.error || "generic"));
        return;
      }
      if (data.status === "translation_not_required") {
        setErrorCode("sameLanguageStrict");
        return;
      }
      setResult({
        status: data.status,
        mode: data.mode,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        segments: Array.isArray(data.segments) ? data.segments : [],
        generatedAt: data.generatedAt ?? null,
        fileName: files.find((f) => f.id === fileId)?.originalFileName ?? "",
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (err?.message === "SESSION_EXPIRED") return;
      setErrorCode("generic");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }, [documentId, fileId, mode, targetLanguage, submitState.canSubmit, files, clearOutput]);

  const downloadPdf = useCallback(async () => {
    if (!result) return;
    setPdfError(false);
    const modeName = result.mode === TRANSLATION_MODES.PLAIN ? t.modePlainName : t.modeStrictName;
    try {
      // Async because the Unicode font is fetched on demand — it is only needed
      // when a patient actually exports, so it stays out of the app bundle.
      await generateTranslationPdf({
        segments: result.segments,
        originalFileName: result.fileName,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        mode: result.mode,
        generatedAt: result.generatedAt,
        labels: {
          documentTitle: t.pdfTitle,
          aiNotice: result.mode === TRANSLATION_MODES.PLAIN ? t.aiNoticePlain : t.aiNoticeStrict,
          originalFileLabel: t.resultOriginalFile,
          modeLabel: t.resultMode,
          modeName,
          sourceLanguageLabel: t.resultSourceLanguage,
          sourceLanguageName: languageName(targetLanguages, result.sourceLanguage),
          targetLanguageLabel: t.resultTargetLanguage,
          targetLanguageName: languageName(targetLanguages, result.targetLanguage),
          generatedAtLabel: t.resultGeneratedAt,
          originalAuthoritative: t.originalAuthoritative,
          fileNameSuffix: t.pdfFileNameSuffix,
        },
      });
    } catch {
      // The error object is deliberately not inspected or logged: it can carry
      // request detail, and the patient only needs to know the export failed.
      setPdfError(true);
    }
  }, [result, t, targetLanguages]);

  // Hidden entirely unless the client flag is on AND the document is the sort
  // of document this feature handles. Neither is an authorisation decision —
  // the server decides — but there is no reason to show a control that would be
  // refused.
  if (!isDocumentTranslationClientEnabled()) return null;
  if (!isTranslatableDocument(document)) return null;

  const errorKey = errorCode ? translationErrorKey(errorCode) : "";
  const errorText = errorCode
    ? (errorCode === "sameLanguageStrict" ? t.hintSameLanguageStrict : t.errors?.[errorKey]) ||
      t.errors?.generic
    : "";
  const unavailable = errorCode ? isUnavailableState(errorCode) : false;
  const canRetry = errorCode ? isRetryableError(errorCode) : false;

  return (
    <section className="doc-translate" aria-labelledby="doc-translate-heading">
      <h2 id="doc-translate-heading" className="doc-translate__heading">
        <Languages size={18} strokeWidth={2} aria-hidden="true" />
        {t.heading}
      </h2>
      <p className="doc-translate__subtitle">{t.subtitle}</p>
      <p className="doc-translate__source-note" role="note">
        {t.sourceLanguageNote}
      </p>

      {/* ── Target language — first, because it applies to both modes ──── */}
      <div className="doc-translate__field">
        <label className="doc-translate__label" htmlFor="doc-translate-language">
          {t.targetLanguageLabel}
        </label>
        <div className="doc-translate__select-wrap">
          <select
            id="doc-translate-language"
            className="doc-translate__select"
            value={targetLanguage}
            disabled={busy}
            onChange={(event) => {
              setTargetLanguage(event.target.value);
              clearOutput();
            }}
          >
            <option value="">{t.targetLanguagePlaceholder}</option>
            {targetLanguages.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName}
              </option>
            ))}
          </select>
          <ChevronDown className="doc-translate__select-icon" size={18} aria-hidden="true" />
        </div>
      </div>

      {/* ── Mode ─────────────────────────────────────────────────────────── */}
      <fieldset className="doc-translate__modes" disabled={busy}>
        <legend className="doc-translate__label">{t.modeLegend}</legend>

        {[
          {
            value: TRANSLATION_MODES.STRICT,
            name: t.modeStrictName,
            description: t.modeStrictDescription,
          },
          {
            value: TRANSLATION_MODES.PLAIN,
            name: t.modePlainName,
            description: t.modePlainDescription,
          },
        ].map((option) => (
          <label
            key={option.value}
            className={`doc-translate__mode${mode === option.value ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name="doc-translate-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => {
                setMode(option.value);
                clearOutput();
              }}
              className="doc-translate__mode-input"
            />
            {/* A drawn control rather than the native dot, so the selected
                state can be shown by shape as well as by colour. The real
                radio above stays in the DOM and keeps the semantics. */}
            <span className="doc-translate__mode-marker" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="doc-translate__mode-body">
              <span className="doc-translate__mode-name">{option.name}</span>
              <span className="doc-translate__mode-description">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* ── Which file ───────────────────────────────────────────────────────
          Only ever the files of this already-opened document. With a single
          file this is a statement, not a choice — a dropdown with one entry
          would imply the patient could supply something else. */}
      {files.length > 1 ? (
        <div className="doc-translate__field">
          <label className="doc-translate__label" htmlFor="doc-translate-file">
            {t.fileLabel}
          </label>
          <div className="doc-translate__select-wrap">
            <select
              id="doc-translate-file"
              className="doc-translate__select"
              value={fileId}
              disabled={busy}
              onChange={(event) => {
                setFileId(event.target.value);
                clearOutput();
              }}
            >
              <option value="">{t.filePlaceholder}</option>
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.originalFileName}
                </option>
              ))}
            </select>
            <ChevronDown className="doc-translate__select-icon" size={18} aria-hidden="true" />
          </div>
        </div>
      ) : files.length === 1 ? (
        <p className="doc-translate__single-file">
          <span className="doc-translate__single-file-label">{t.fileLabel}</span>
          <span className="doc-translate__single-file-name">{files[0].originalFileName}</span>
        </p>
      ) : null}

      {sameLanguageStrict ? (
        <p className="doc-translate__hint" role="note">
          {t.hintSameLanguageStrict}
        </p>
      ) : null}

      <button
        type="button"
        className="doc-translate__submit"
        onClick={() => void run()}
        disabled={!submitState.canSubmit}
      >
        {busy ? t.submitBusy : t.submit}
      </button>

      <p className="doc-translate__status" aria-live="polite">
        {busy ? t.statusRunning : ""}
      </p>

      {errorText ? (
        <div
          className={`doc-translate__error${unavailable ? " is-neutral" : ""}`}
          role="alert"
        >
          <span>{errorText}</span>
          {canRetry ? (
            <button type="button" className="doc-translate__retry" onClick={() => void run()}>
              {t.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {result ? (
        <article className="doc-translate__result" aria-labelledby="doc-translate-result-heading">
          <h3 id="doc-translate-result-heading" className="doc-translate__result-heading">
            {result.mode === TRANSLATION_MODES.PLAIN ? t.aiNoticePlain : t.aiNoticeStrict}
          </h3>

          <dl className="doc-translate__meta">
            <dt>{t.resultOriginalFile}</dt>
            <dd>{result.fileName}</dd>
            <dt>{t.resultMode}</dt>
            <dd>
              {result.mode === TRANSLATION_MODES.PLAIN ? t.modePlainName : t.modeStrictName}
            </dd>
            <dt>{t.resultTargetLanguage}</dt>
            <dd>{languageName(targetLanguages, result.targetLanguage)}</dd>
            {result.generatedAt ? (
              <>
                <dt>{t.resultGeneratedAt}</dt>
                <dd>{formatDateTime(result.generatedAt, language)}</dd>
              </>
            ) : null}
          </dl>

          <p className="doc-translate__disclaimer" role="note">
            {t.originalAuthoritative}
            {result.mode === TRANSLATION_MODES.PLAIN ? ` ${t.plainNotAdvice}` : ""}
          </p>

          {/* Text nodes only — never markup. */}
          <div className="doc-translate__body">
            {result.segments.map((segment, position) =>
              segment.kind === "heading" ? (
                <h4 key={segment.id ?? position} className="doc-translate__segment-heading">
                  {segment.text}
                </h4>
              ) : (
                <p key={segment.id ?? position} className="doc-translate__segment">
                  {segment.text}
                </p>
              ),
            )}
          </div>

          <div className="doc-translate__result-actions">
            {onViewOriginal ? (
              <button
                type="button"
                className="doc-translate__secondary"
                onClick={() => onViewOriginal(fileId)}
              >
                {t.viewOriginal}
              </button>
            ) : null}

            {canExportPdfForLanguage(result.targetLanguage) ? (
              <button
                type="button"
                className="doc-translate__secondary"
                onClick={() => void downloadPdf()}
              >
                {t.downloadPdf}
              </button>
            ) : (
              /* Unreachable for the six shipped languages — the bundled font
                 covers Latin and Cyrillic. Kept so that activating a seventh UI
                 language cannot silently produce a PDF in a script the font
                 does not contain. */
              <p className="doc-translate__pdf-unavailable" role="note">
                {t.pdfUnavailableForLanguage}
              </p>
            )}
          </div>

          {pdfError ? (
            <p className="doc-translate__pdf-unavailable" role="alert">
              {t.pdfExportFailed}
            </p>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}

/** @param {{ code: string, nativeName: string }[]} options @param {string} code */
function languageName(options, code) {
  return options.find((option) => option.code === code)?.nativeName ?? code ?? "";
}

/** @param {string} iso @param {string} uiLanguage */
function formatDateTime(iso, uiLanguage) {
  try {
    return new Date(iso).toLocaleString(uiLanguage, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}
