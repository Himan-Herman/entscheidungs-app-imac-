import { useCallback, useEffect, useState } from "react";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  downloadScopedDocumentFile,
  fetchScopedDocuments,
} from "../api/scopedDocumentsApi.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
// The same stylesheets the cross-practice document list uses — this page is a
// context migration of that list, not a new visual language.
import "../../../styles/PatientInboxPage.css";
import "../../practiceDocuments/styles/PracticeDocuments.css";

/**
 * Documents of one care relationship (Phase 2E.2).
 *
 * A context migration, not a redesign: it reuses the existing
 * `patientPracticeDocuments` i18n namespace and the `patient-inbox__*`
 * presentation of the cross-practice list, so a document looks the way the
 * patient already knows it — only inside an explicit practice context.
 *
 * Two classes of document can appear, and the difference is stated in words:
 * one the practice released to the patient, and one the patient released INTO
 * this practice from elsewhere. Showing them without that distinction would
 * suggest this practice authored a document it merely received.
 *
 * Every request runs through useScopedRequest, so a response can only be
 * applied while its own context is still active.
 */

/** Document types share the vocabulary of the cross-practice list. */
function typeLabel(type, t) {
  const map = {
    report: t.typeReport,
    lab: t.typeLab,
    imaging: t.typeImaging,
    referral: t.typeReferral,
    discharge: t.typeDischarge,
    prescription_info: t.typePrescriptionInfo,
    other: t.typeOther,
  };
  return map[type] || t.typeOther;
}

function formatSize(bytes) {
  if (typeof bytes !== "number" || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PracticeContextDocumentsPage() {
  const { linkId } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t =
    getMessages(language).patientPracticeDocuments ||
    getMessages("en").patientPracticeDocuments;
  const tc = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyFileId, setBusyFileId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const outcome = await run(
        ({ signal }) => fetchScopedDocuments(linkId, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setDocuments([]);
            setError(res.status === 404 ? tc.notFoundBody : t.loadError);
            return;
          }
          setDocuments(Array.isArray(data.documents) ? data.documents : []);
        },
      );
      if (!outcome.applied) return;
    } catch {
      setDocuments([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, run, t.loadError, tc.notFoundBody]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The list the patient sees can be a moment out of date, so a refused
   * download is a normal outcome, not a bug: the server decides again on this
   * request. A 404 therefore reports "no longer available" rather than an error.
   */
  const download = async (doc, file) => {
    setBusyFileId(file.id);
    setError("");
    try {
      await run(
        ({ signal }) => downloadScopedDocumentFile(linkId, doc.id, file.id, { signal }),
        ({ res, blob }) => {
          if (!res.ok || !blob) {
            setError(res.status === 404 ? t.notAvailable : t.downloadError);
            // Re-read the context so the list stops offering what was refused.
            load();
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.fileName || doc.title || "document";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
      );
    } catch {
      setError(t.downloadError);
    } finally {
      setBusyFileId("");
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(language), {
        dateStyle: "medium",
      });
    } catch {
      return "";
    }
  };

  /** Where a document came from — never left to the reader to infer. */
  const originLabel = (doc) => {
    if (doc.origin !== "shared") return tc.documentsOriginDirect;
    if (doc.sourcePracticeName) {
      return tc.documentsOriginSharedFrom.replace("{practice}", doc.sourcePracticeName);
    }
    return tc.documentsOriginShared;
  };

  return (
    <div className="practice-context patient-inbox practice-documents-list">
      <h1 className="practice-context__title">{tc.documentsTitle}</h1>
      <p className="patient-inbox__intro">{tc.documentsScopeNote}</p>

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {error ? (
        <p className="practice-context__state" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && documents.length === 0 ? (
        <p className="practice-context__state">{tc.documentsEmpty}</p>
      ) : null}

      {!loading && documents.length > 0 ? (
        <ul className="patient-inbox__list" data-testid="scoped-document-list">
          {documents.map((doc) => (
            <li key={doc.id} className="patient-inbox__item">
              <h2 className="patient-inbox__item-title">{doc.title}</h2>
              <p className="patient-inbox__item-meta">
                {typeLabel(doc.type, t)}
                {doc.sharedAt ? ` · ${t.sharedAt.replace("{date}", fmtDate(doc.sharedAt))}` : ""}
              </p>
              {/* Origin is a word, never only a position in the list. */}
              <p className="patient-inbox__muted" data-testid="document-origin">
                {originLabel(doc)}
              </p>

              {Array.isArray(doc.files) && doc.files.length > 0 ? (
                <ul className="practice-documents__file-list">
                  {doc.files.map((file) => (
                    <li key={file.id}>
                      <span className="practice-documents__file-name">
                        {file.fileName}
                        {formatSize(file.sizeBytes) ? ` · ${formatSize(file.sizeBytes)}` : ""}
                      </span>
                      <span className="practice-documents__file-actions">
                        <button
                          type="button"
                          className="patient-inbox__btn"
                          disabled={busyFileId === file.id}
                          onClick={() => download(doc, file)}
                        >
                          {t.download}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="patient-inbox__muted">{t.noFiles}</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="patient-inbox__safety">{t.safetyNote}</p>
    </div>
  );
}
