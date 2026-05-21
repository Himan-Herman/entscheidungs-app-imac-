import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchPatientExports,
  postPatientExport,
  downloadPatientExport,
  postPatientExportAiOrganize,
} from "../api/patientExportsApi.js";
import {
  fetchPracticeExports,
  postPracticeExport,
  postPracticePatientExport,
  downloadPracticeExport,
  postPracticeExportAiOrganize,
} from "../api/practiceExportsApi.js";
import { downloadExportBlob } from "../utils/downloadExportBlob.js";
import "../../../styles/ExportsPage.css";

const PATIENT_TYPES = [
  { value: "medication_plans", labelKey: "typeMedicationPlans" },
  { value: "practice_documents_list", labelKey: "typeDocumentsList" },
  { value: "profile_sharing", labelKey: "typeProfileSharing" },
  { value: "activity", labelKey: "typeActivity" },
  { value: "data_requests", labelKey: "typeDataRequests" },
];

const PRACTICE_RECORD_TYPES = [
  { value: "patient_summary", labelKey: "typePatientSummary" },
  { value: "medication_plan", labelKey: "typeMedicationPlan" },
  { value: "documents_list", labelKey: "typeDocumentsListPractice" },
  { value: "activity", labelKey: "typeActivity" },
  { value: "data_requests", labelKey: "typeDataRequests" },
];

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function statusLabel(status, t) {
  const map = {
    pending: t.statusPending,
    processing: t.statusProcessing,
    completed: t.statusCompleted,
    failed: t.statusFailed,
    expired: t.statusExpired,
  };
  return map[status] || status;
}

function isExportInFlight(row) {
  return row?.processing || row?.status === "pending" || row?.status === "processing";
}

/**
 * @param {{ audience: 'patient' | 'practice', practiceId?: string, linkId?: string, compact?: boolean }} props
 */
export default function ExportsPanel({ audience, practiceId, linkId, compact = false }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).exports || getMessages("en").exports,
    [language],
  );

  const typeOptions = audience === "patient" ? PATIENT_TYPES : PRACTICE_RECORD_TYPES;

  const [exports, setExports] = useState([]);
  const [exportType, setExportType] = useState(typeOptions[0]?.value || "");
  const [format, setFormat] = useState("pdf");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const loadExports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (audience === "patient") {
        const { res, data } = await fetchPatientExports();
        if (!res.ok || !data.ok) throw new Error("load_failed");
        setExports(Array.isArray(data.exports) ? data.exports : []);
      } else if (practiceId) {
        const { res, data } = await fetchPracticeExports(practiceId);
        if (!res.ok || !data.ok) throw new Error("load_failed");
        setExports(Array.isArray(data.exports) ? data.exports : []);
      } else {
        setExports([]);
      }
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setExports([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [audience, practiceId, t.loadError]);

  useEffect(() => {
    void loadExports();
  }, [loadExports]);

  const hasInFlight = exports.some(isExportInFlight);

  useEffect(() => {
    if (!hasInFlight) return undefined;
    const id = window.setInterval(() => {
      void loadExports();
    }, 4000);
    return () => window.clearInterval(id);
  }, [hasInFlight, loadExports]);

  const typeLabel = (type) => {
    const opt = [...PATIENT_TYPES, ...PRACTICE_RECORD_TYPES].find((o) => o.value === type);
    return opt ? t[opt.labelKey] : type;
  };

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      if (audience === "patient") {
        const { res, data } = await postPatientExport({
          type: exportType,
          format,
          locale: language,
        });
        if (!res.ok || !data.ok) throw new Error("create_failed");
      } else if (linkId && practiceId) {
        const { res, data } = await postPracticePatientExport(linkId, {
          practiceId,
          type: exportType,
          format,
          locale: language,
        });
        if (!res.ok || !data.ok) throw new Error("create_failed");
      } else if (practiceId) {
        const { res, data } = await postPracticeExport({
          practiceId,
          type: exportType,
          format,
          locale: language,
        });
        if (!res.ok || !data.ok) throw new Error("create_failed");
      }
      await loadExports();
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.createError);
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(exportId, exportFormat) {
    try {
      const res =
        audience === "patient"
          ? await downloadPatientExport(exportId)
          : await downloadPracticeExport(exportId, practiceId);
      await downloadExportBlob(res, `export.${exportFormat}`);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.downloadError);
    }
  }

  async function handleAi(exportId) {
    setAiBusy(true);
    setAiText("");
    try {
      const { res, data } =
        audience === "patient"
          ? await postPatientExportAiOrganize(exportId, language)
          : await postPracticeExportAiOrganize(exportId, practiceId, language);
      if (!res.ok || !data.ok) throw new Error("ai_failed");
      setAiText(data.text || "");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setAiText(t.aiError);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <section className={compact ? "" : "exports-page"} aria-labelledby="exports-panel-heading">
      <h2 id="exports-panel-heading" className={compact ? "practice-dashboard__analytics-heading" : "practice-dashboard__title"}>
        {compact ? t.recordSectionTitle : audience === "patient" ? t.headingPatient : t.headingPractice}
      </h2>
      {!compact ? <p className="practice-dashboard__intro">{t.intro}</p> : null}
      <p className="practice-dashboard__safety" role="note">
        {t.safetyNote}
      </p>

      <form
        className="exports-page__form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
      >
        <label>
          <span>{t.exportType}</span>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            aria-label={t.exportType}
          >
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t[opt.labelKey]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.exportFormat}</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            aria-label={t.exportFormat}
          >
            <option value="pdf">{t.formatPdf}</option>
            <option value="csv">{t.formatCsv}</option>
          </select>
        </label>
        <button
          type="submit"
          className="patient-threads__btn patient-threads__btn--primary"
          disabled={creating}
          aria-busy={creating}
        >
          {creating ? t.creating : t.requestExport}
        </button>
      </form>

      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}

      {!loading && exports.length === 0 ? (
        <p className="practice-dashboard__muted" role="status">
          {t.empty}
        </p>
      ) : null}

      {!loading && exports.length > 0 ? (
        <ul className="exports-page__list" aria-label={t.headingPatient}>
          {exports.map((row) => (
            <li key={row.id} className="exports-page__item">
              <strong>{typeLabel(row.type)}</strong>
              <span className="practice-dashboard__muted">
                {" "}
                · {row.format.toUpperCase()} · {statusLabel(row.status, t)}
              </span>
              <p className="practice-dashboard__muted" style={{ margin: "0.35rem 0 0" }}>
                {t.createdAt}: {fmt(row.createdAt, language)}
                {row.expiresAt ? ` · ${t.expiresAt}: ${fmt(row.expiresAt, language)}` : ""}
              </p>
              <div className="exports-page__actions">
                {row.downloadReady ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--primary"
                    onClick={() => void handleDownload(row.id, row.format)}
                  >
                    {t.download}
                  </button>
                ) : null}
                {row.status === "completed" ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    onClick={() => void handleAi(row.id)}
                    disabled={aiBusy}
                  >
                    {aiBusy ? t.aiOrganizeLoading : t.aiOrganize}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {aiText ? (
        <div className="exports-page__ai" role="region" aria-labelledby="export-ai-heading">
          <h3 id="export-ai-heading">{t.aiHeading}</h3>
          <p className="practice-dashboard__muted">{t.aiHint}</p>
          <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{aiText}</pre>
        </div>
      ) : null}
    </section>
  );
}
