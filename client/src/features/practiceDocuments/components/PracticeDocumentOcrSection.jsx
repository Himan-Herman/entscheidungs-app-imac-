import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  discardDocumentOcrResult,
  fetchDocumentOcrResult,
  fetchDocumentOcrStatus,
  patchDocumentOcrResult,
  shareDocumentOcrResult,
  startDocumentOcr,
} from "../api/documentOcrApi.js";
import "../styles/DocumentOcrSection.css";

/**
 * @param {{ linkId: string, practiceId: string, documentId: string, fileId?: string, documentType: string, readOnly?: boolean }} props
 */
export default function PracticeDocumentOcrSection({
  linkId,
  practiceId,
  documentId,
  fileId,
  documentType,
  readOnly = false,
}) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).documentOcr || getMessages("en").documentOcr,
    [language],
  );

  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [editing, setEditing] = useState(false);

  const reload = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError("");
    const { res: sRes, data: sData } = await fetchDocumentOcrStatus(linkId, practiceId, documentId);
    if (sRes.status === 404) {
      setError(t.featureDisabled);
      setLoading(false);
      return;
    }
    if (sRes.ok && sData.ok) setJob(sData.job);

    const { res, data } = await fetchDocumentOcrResult(linkId, practiceId, documentId);
    if (res.ok && data.ok && data.result) {
      setResult(data.result);
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } else {
      setResult(null);
      setEntries([]);
    }
    setLoading(false);
  }, [documentId, linkId, practiceId, t.featureDisabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onStart = async () => {
    if (!fileId) {
      setError(t.selectFile);
      return;
    }
    setLoading(true);
    setError("");
    const { res, data } = await startDocumentOcr(linkId, practiceId, documentId, fileId);
    setLoading(false);
    if (!res.ok || !data.ok) {
      if (data.error === "consent_required") setError(t.consentRequired);
      else if (res.status === 503 || data.error === "ocr_unavailable") setError(t.unavailable);
      else setError(t.unavailable);
      return;
    }
    setStatusMsg(t.autoDetectedHint);
    await reload();
  };

  const onSave = async () => {
    setLoading(true);
    const { res, data } = await patchDocumentOcrResult(linkId, practiceId, documentId, {
      entries,
      reviewStatus: "reviewed",
    });
    setLoading(false);
    if (res.ok && data.ok) {
      setResult(data.result);
      setEntries(data.entries || []);
      setEditing(false);
      setStatusMsg(t.saved);
    }
  };

  const onShare = async () => {
    setLoading(true);
    const { res, data } = await shareDocumentOcrResult(linkId, practiceId, documentId);
    setLoading(false);
    if (res.ok && data.ok) {
      setStatusMsg(t.shared);
      await reload();
    }
  };

  const onDiscard = async () => {
    setLoading(true);
    const { res } = await discardDocumentOcrResult(linkId, practiceId, documentId);
    setLoading(false);
    if (res.ok) {
      setStatusMsg(t.discarded);
      setResult(null);
      setEntries([]);
      setJob(null);
    }
  };

  const updateEntry = (index, field, value) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  };

  const canShare = !readOnly && result && ["needs_review", "reviewed"].includes(result.reviewStatus);

  return (
    <section className="document-ocr" aria-labelledby="document-ocr-heading">
      <h3 id="document-ocr-heading">{t.structuredViewHeading}</h3>
      <p className="document-ocr__hint" role="note">
        {t.aiOcrHint} — {t.autoDetectedHint}
      </p>

      {job ? (
        <p aria-live="polite">
          <strong>{t.jobStatus}:</strong> {t[`status_${job.status}`] || job.status}
          {result?.reviewStatus
            ? ` · ${t[`review_${result.reviewStatus}`] || result.reviewStatus}`
            : null}
        </p>
      ) : null}

      {loading ? <p aria-live="polite">{t.loading}</p> : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}
      {statusMsg ? <p aria-live="polite">{statusMsg}</p> : null}

      {!readOnly ? (
        <div className="document-ocr__actions">
          <button
            type="button"
            className="document-ocr__btn document-ocr__btn--primary"
            disabled={loading || !fileId}
            onClick={() => void onStart()}
            aria-label={t.structureDocument}
          >
            {t.structureDocument}
          </button>
          {result ? (
            <>
              <button
                type="button"
                className="document-ocr__btn"
                disabled={loading}
                onClick={() => setEditing((v) => !v)}
              >
                {t.reviewResult}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="document-ocr__btn document-ocr__btn--primary"
                  disabled={loading}
                  onClick={() => void onSave()}
                >
                  {t.saveCorrection}
                </button>
              ) : null}
              {canShare ? (
                <button
                  type="button"
                  className="document-ocr__btn document-ocr__btn--primary"
                  disabled={loading}
                  onClick={() => void onShare()}
                >
                  {t.shareWithPatient}
                </button>
              ) : null}
              <button
                type="button"
                className="document-ocr__btn"
                disabled={loading}
                onClick={() => void onDiscard()}
              >
                {t.discardResult}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {documentType === "lab" && entries.length > 0 ? (
        <>
          <h4>{t.labTableHeading}</h4>
          <div className="document-ocr__table-wrap">
            <table className="document-ocr__table" aria-label={t.labTableHeading}>
              <thead>
                <tr>
                  <th scope="col">{t.colLabel}</th>
                  <th scope="col">{t.colValue}</th>
                  <th scope="col">{t.colUnit}</th>
                  <th scope="col">{t.colReference}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row, i) => (
                  <tr key={row.id || i}>
                    <td>
                      {editing ? (
                        <input
                          value={row.label}
                          onChange={(e) => updateEntry(i, "label", e.target.value)}
                          aria-label={`${t.colLabel} ${i + 1}`}
                        />
                      ) : (
                        row.label
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          value={row.valueText}
                          onChange={(e) => updateEntry(i, "valueText", e.target.value)}
                          aria-label={`${t.colValue} ${i + 1}`}
                        />
                      ) : (
                        row.valueText || t.unclear
                      )}
                    </td>
                    <td>{row.unit || t.notProvided}</td>
                    <td>{row.referenceRangeText || t.notProvided}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="document-ocr__cards" aria-label={t.labTableHeading}>
            {entries.map((row, i) => (
              <dl key={row.id || i} className="document-ocr__card">
                <dt>{t.colLabel}</dt>
                <dd>{row.label}</dd>
                <dt>{t.colValue}</dt>
                <dd>{row.valueText || t.unclear}</dd>
                <dt>{t.colUnit}</dt>
                <dd>{row.unit || t.notProvided}</dd>
                <dt>{t.colReference}</dt>
                <dd>{row.referenceRangeText || t.notProvided}</dd>
              </dl>
            ))}
          </div>
        </>
      ) : result ? (
        <p>{t.noEntries}</p>
      ) : null}
    </section>
  );
}
