import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { formatUiDateTime } from "../../../i18n/intlLocale.js";
import { authFetch } from "../../../api/authFetch.js";
import { apiFetch } from "../../../lib/api.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import {
  computePreVisitAiFingerprint,
  normalizeLongitudinalCase,
  PREVISIT_LOCALE_STORAGE_KEY,
  resetSessionForCaseFollowUp,
  savePreVisitSession,
} from "../constants/preVisitSession.js";
import { PRE_VISIT_QUESTION_STEPS } from "../constants/questionFlow.js";
import "../styles/PreVisitCaseDetailPage.css";

export default function PreVisitCaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).preVisit.caseDetail, [language]);
  const tDoc = useMemo(() => getMessages(language).preVisit.document, [language]);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionsPool, setSessionsPool] = useState([]);
  const [attachSessionId, setAttachSessionId] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [diffResult, setDiffResult] = useState(null);
  const [diffBusy, setDiffBusy] = useState(false);
  const [continuity, setContinuity] = useState(null);
  const [continuityBusy, setContinuityBusy] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const hasToken = !!localStorage.getItem("medscout_token");

  const loadCase = useCallback(async () => {
    if (!caseId || !hasToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/previsit/cases/${encodeURIComponent(caseId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("load");
      setDetail(data.case);
      setEditTitle(data.case?.title || "");
      setEditDesc(data.case?.description || "");
      setEditCategory(data.case?.category || "");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, hasToken, t.loadError]);

  const loadSessionsPool = useCallback(async () => {
    if (!hasToken) return;
    try {
      const res = await authFetch("/api/previsit/sessions");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return;
      setSessionsPool(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setSessionsPool([]);
    }
  }, [hasToken]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  useEffect(() => {
    void loadSessionsPool();
  }, [loadSessionsPool]);

  async function saveMeta(e) {
    e.preventDefault();
    if (!caseId) return;
    setSavingMeta(true);
    try {
      const res = await authFetch(`/api/previsit/cases/${encodeURIComponent(caseId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          category: editCategory.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("save");
      await loadCase();
    } catch {
      setError(t.saveError);
    } finally {
      setSavingMeta(false);
    }
  }

  async function toggleArchive() {
    if (!detail) return;
    try {
      const res = await authFetch(`/api/previsit/cases/${encodeURIComponent(caseId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !detail.isArchived }),
      });
      if (!res.ok) throw new Error("arch");
      await loadCase();
    } catch {
      setError(t.saveError);
    }
  }

  async function deleteCase() {
    if (!window.confirm(t.confirmDeleteCase)) return;
    try {
      const res = await authFetch(`/api/previsit/cases/${encodeURIComponent(caseId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("del");
      navigate("/pre-visit/cases");
    } catch {
      setError(t.deleteError);
    }
  }

  async function attachSession() {
    if (!attachSessionId) return;
    try {
      const res = await authFetch(
        `/api/previsit/sessions/${encodeURIComponent(attachSessionId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preVisitCaseId: caseId }),
        },
      );
      if (!res.ok) throw new Error("attach");
      setAttachSessionId("");
      await loadCase();
      await loadSessionsPool();
    } catch {
      setError(t.attachError);
    }
  }

  async function unlinkSession(sid) {
    try {
      const res = await authFetch(`/api/previsit/sessions/${encodeURIComponent(sid)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preVisitCaseId: null }),
      });
      if (!res.ok) throw new Error("unlink");
      await loadCase();
      await loadSessionsPool();
    } catch {
      setError(t.unlinkError);
    }
  }

  async function deleteSession(sid) {
    if (!window.confirm(t.confirmDeleteSession)) return;
    try {
      const res = await authFetch(`/api/previsit/sessions/${encodeURIComponent(sid)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("ds");
      await loadCase();
      await loadSessionsPool();
    } catch {
      setError(t.deleteSessionError);
    }
  }

  async function clearPdfFlag(sid) {
    try {
      const res = await authFetch(`/api/previsit/sessions/${encodeURIComponent(sid)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfDownloaded: false, status: "draft" }),
      });
      if (!res.ok) throw new Error("pdf");
      await loadCase();
    } catch {
      setError(t.pdfClearError);
    }
  }

  function hydrateFullSession(record) {
    const answers =
      record.answers && typeof record.answers === "object" && !Array.isArray(record.answers)
        ? JSON.parse(JSON.stringify(record.answers))
        : {};
    const doctorLang = record.doctorLanguage || record.patientLanguage || "de";
    const patientLang = record.patientLanguage || "de";
    const completedStep = PRE_VISIT_QUESTION_STEPS.length - 1;
    const payload = {
      patientLanguage: patientLang,
      doctorLanguage: doctorLang,
      answers,
      stepIndex: completedStep,
    };
    if (record.aiDoctorVersion != null) {
      payload.aiDoctorVersion = record.aiDoctorVersion;
      payload.aiSafetyNotice =
        typeof record.aiSafetyNotice === "string" ? record.aiSafetyNotice : "";
      payload.aiDoctorVersionFingerprint = computePreVisitAiFingerprint(
        answers,
        doctorLang,
      );
    }
    const caseTimeline =
      answers?.caseTimeline &&
      typeof answers.caseTimeline === "object" &&
      !Array.isArray(answers.caseTimeline)
        ? answers.caseTimeline
        : null;
    if (caseTimeline) {
      payload.caseTimeline = {
        relatedSessionId: String(caseTimeline.relatedSessionId || ""),
        caseTopic: String(caseTimeline.caseTopic || ""),
        includeInPdf: Boolean(caseTimeline.includeInPdf),
        summary:
          caseTimeline.summary && typeof caseTimeline.summary === "object"
            ? caseTimeline.summary
            : null,
      };
    }
    if (record.pdfDownloaded === true || record.status === "pdf_created") {
      payload.pdfDownloaded = true;
    }
    if (record.preVisitCaseId) {
      const lc = normalizeLongitudinalCase({
        caseId: record.preVisitCaseId,
        caseTitle: detail?.title || "",
        compactTimelineSnippet: "",
        pdfInclude: {
          caseTitle: false,
          continuitySummary: false,
          sessionsOverview: false,
          relatedReportsSummary: false,
        },
      });
      if (lc) payload.longitudinalCase = lc;
    }
    savePreVisitSession(payload);
    try {
      sessionStorage.setItem(PREVISIT_LOCALE_STORAGE_KEY, patientLang);
    } catch {
      /* ignore */
    }
  }

  async function reopenSession(sid) {
    try {
      const res = await authFetch(`/api/previsit/sessions/${encodeURIComponent(sid)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.session) throw new Error("get");
      hydrateFullSession(data.session);
      navigate("/pre-visit/document");
    } catch {
      setError(t.reopenError);
    }
  }

  async function handleFollowUp() {
    try {
      const res = await authFetch(
        `/api/previsit/cases/${encodeURIComponent(caseId)}/compact-intake-context`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("compact");
      const loc =
        sessionStorage.getItem(PREVISIT_LOCALE_STORAGE_KEY) || language || "de";
      resetSessionForCaseFollowUp({
        patientLanguage: loc,
        caseId,
        caseTitle: detail?.title || data.caseTitle || "",
        compactTimelineSnippet: data.snippet || "",
        continuitySummary: continuity,
      });
      navigate("/pre-visit/chat");
    } catch {
      setError(t.followUpError);
    }
  }

  async function runCompare() {
    if (!compareA || !compareB || compareA === compareB) {
      setError(t.pickTwoSessions);
      return;
    }
    setDiffBusy(true);
    setDiffResult(null);
    setError("");
    try {
      const [sa, sb] =
        compareA < compareB
          ? [await fetchSessionAnswers(compareA), await fetchSessionAnswers(compareB)]
          : [await fetchSessionAnswers(compareB), await fetchSessionAnswers(compareA)];
      const dl = language === "de" ? "de" : "en";
      const diff = await apiFetch("/api/previsit/history-diff", {
        method: "POST",
        body: JSON.stringify({
          previousAnswers: sa,
          currentAnswers: sb,
          patientLanguage: dl,
          doctorLanguage: dl,
        }),
      });
      setDiffResult(diff);
    } catch {
      setError(t.compareError);
    } finally {
      setDiffBusy(false);
    }
  }

  async function fetchSessionAnswers(sid) {
    const res = await authFetch(`/api/previsit/sessions/${encodeURIComponent(sid)}`);
    const data = await res.json();
    if (!res.ok || !data.session?.answers) throw new Error("answers");
    return data.session.answers;
  }

  async function generateContinuity() {
    setContinuityBusy(true);
    setContinuity(null);
    setError("");
    try {
      const dl = language === "de" ? "de" : "en";
      const res = await authFetch(
        `/api/previsit/cases/${encodeURIComponent(caseId)}/continuity-summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientLanguage: dl, doctorLanguage: dl }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("cont");
      setContinuity({
        recurringSymptoms: data.recurringSymptoms || [],
        recurringMedications: data.recurringMedications || [],
        recurringPatientQuestions: data.recurringPatientQuestions || [],
        recurringConcerns: data.recurringConcerns || [],
      });
    } catch {
      setError(t.continuityError);
    } finally {
      setContinuityBusy(false);
    }
  }

  function pushContinuityToPreparation() {
    if (!continuity) return;
    const loc = sessionStorage.getItem(PREVISIT_LOCALE_STORAGE_KEY) || language || "de";
    resetSessionForCaseFollowUp({
      patientLanguage: loc,
      caseId,
      caseTitle: detail?.title || "",
      continuitySummary: continuity,
      compactTimelineSnippet: "",
    });
    navigate("/pre-visit/chat");
  }

  if (!hasToken) {
    return (
      <div className="pre-visit-case-detail">
        <div className="pre-visit-case-detail__inner">
          <PreVisitModuleChrome />
          <p>{t.loginHint}</p>
          <Link to="/login">{t.loginCta}</Link>
        </div>
      </div>
    );
  }

  const timeline = detail?.sessions || [];
  const attachable = sessionsPool.filter(
    (s) => s.preVisitCaseId !== caseId && String(s.preVisitCaseId || "") !== String(caseId),
  );

  return (
    <div className="pre-visit-case-detail">
      <div className="pre-visit-case-detail__inner">
        <PreVisitModuleChrome />
        <nav className="pre-visit-case-detail__crumb">
          <Link to="/pre-visit/cases">{t.backToList}</Link>
        </nav>

        {loading ? <p className="pre-visit-case-detail__muted">{t.loading}</p> : null}
        {error ? (
          <p className="pre-visit-case-detail__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && detail ? (
          <>
            <header className="pre-visit-case-detail__header">
              <h1 className="pre-visit-case-detail__title">{detail.title}</h1>
              {detail.isArchived ? (
                <span className="pre-visit-case-detail__badge">{t.archived}</span>
              ) : null}
              <p className="pre-visit-case-detail__safety">{t.safetyNote}</p>
            </header>

            <form className="pre-visit-case-detail__form" onSubmit={saveMeta}>
              <label className="pre-visit-case-detail__label">
                {t.fieldTitle} *
                <input
                  className="pre-visit-case-detail__input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  maxLength={140}
                />
              </label>
              <label className="pre-visit-case-detail__label">
                {t.fieldCategory}
                <input
                  className="pre-visit-case-detail__input"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  maxLength={80}
                />
              </label>
              <label className="pre-visit-case-detail__label">
                {t.fieldDescription}
                <textarea
                  className="pre-visit-case-detail__textarea"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <button
                type="submit"
                className="pre-visit-case-detail__btn pre-visit-case-detail__btn--primary"
                disabled={savingMeta}
              >
                {t.saveMeta}
              </button>
            </form>

            <div className="pre-visit-case-detail__actions">
              <button
                type="button"
                className="pre-visit-case-detail__btn"
                onClick={() => void toggleArchive()}
              >
                {detail.isArchived ? t.unarchive : t.archive}
              </button>
              <button type="button" className="pre-visit-case-detail__btn" onClick={handleFollowUp}>
                {t.followUp}
              </button>
              <button
                type="button"
                className="pre-visit-case-detail__btn pre-visit-case-detail__btn--danger"
                onClick={() => void deleteCase()}
              >
                {t.deleteCase}
              </button>
            </div>

            <section className="pre-visit-case-detail__section" aria-labelledby="case-attach-heading">
              <h2 id="case-attach-heading" className="pre-visit-case-detail__section-title">
                {t.attachSession}
              </h2>
              <div className="pre-visit-case-detail__row">
                <select
                  className="pre-visit-case-detail__select"
                  value={attachSessionId}
                  onChange={(e) => setAttachSessionId(e.target.value)}
                >
                  <option value="">{t.selectSession}</option>
                  {attachable.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatUiDateTime(s.createdAt, language)} — {(s.title || "").trim() || s.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="pre-visit-case-detail__btn pre-visit-case-detail__btn--primary"
                  disabled={!attachSessionId}
                  onClick={() => void attachSession()}
                >
                  {t.attachConfirm}
                </button>
              </div>
            </section>

            <section className="pre-visit-case-detail__section" aria-labelledby="case-timeline-heading">
              <h2 id="case-timeline-heading" className="pre-visit-case-detail__section-title">
                {t.timeline}
              </h2>
              {timeline.length === 0 ? (
                <p className="pre-visit-case-detail__muted">{t.emptyTimeline}</p>
              ) : (
                <ul className="pre-visit-case-detail__timeline">
                  {timeline.map((row) => (
                    <li key={row.id} className="pre-visit-case-detail__timeline-card">
                      <p className="pre-visit-case-detail__timeline-date">
                        {formatUiDateTime(row.createdAt, language)}
                      </p>
                      <p className="pre-visit-case-detail__timeline-reason">
                        {row.appointmentReasonPreview || tDoc.empty}
                      </p>
                      {row.practiceContextSnippet ? (
                        <p className="pre-visit-case-detail__timeline-meta">{row.practiceContextSnippet}</p>
                      ) : null}
                      <div className="pre-visit-case-detail__timeline-actions">
                        <button
                          type="button"
                          className="pre-visit-case-detail__btn"
                          onClick={() => void reopenSession(row.id)}
                        >
                          {t.reopen}
                        </button>
                        <button type="button" className="pre-visit-case-detail__btn" onClick={() => void clearPdfFlag(row.id)}>
                          {t.clearPdf}
                        </button>
                        <button
                          type="button"
                          className="pre-visit-case-detail__btn"
                          onClick={() => void unlinkSession(row.id)}
                        >
                          {t.unlink}
                        </button>
                        <button
                          type="button"
                          className="pre-visit-case-detail__btn pre-visit-case-detail__btn--danger"
                          onClick={() => void deleteSession(row.id)}
                        >
                          {t.deleteSession}
                        </button>
                      </div>
                      {row.pdfDownloaded ? (
                        <span className="pre-visit-case-detail__pill">{t.pdfReady}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pre-visit-case-detail__section" aria-labelledby="case-compare-heading">
              <h2 id="case-compare-heading" className="pre-visit-case-detail__section-title">
                {t.compareTitle}
              </h2>
              <p className="pre-visit-case-detail__hint">{t.compareHint}</p>
              <div className="pre-visit-case-detail__row">
                <select
                  className="pre-visit-case-detail__select"
                  value={compareA}
                  onChange={(e) => setCompareA(e.target.value)}
                >
                  <option value="">{t.sessionA}</option>
                  {timeline.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatUiDateTime(row.createdAt, language)}
                    </option>
                  ))}
                </select>
                <select
                  className="pre-visit-case-detail__select"
                  value={compareB}
                  onChange={(e) => setCompareB(e.target.value)}
                >
                  <option value="">{t.sessionB}</option>
                  {timeline.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatUiDateTime(row.createdAt, language)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="pre-visit-case-detail__btn pre-visit-case-detail__btn--primary"
                  disabled={diffBusy}
                  onClick={() => void runCompare()}
                >
                  {diffBusy ? t.comparing : t.compareRun}
                </button>
              </div>
              {diffResult ? (
                <div className="pre-visit-case-detail__diff">
                  {[
                    ["newlyMentioned", t.diffNew],
                    ["stillMentioned", t.diffStill],
                    ["noLongerMentioned", t.diffGone],
                    ["unclear", t.diffUnclear],
                    ["patientAddedNewInformation", t.diffAddedInfo],
                    ["patientDidNotMentionPreviouslyReportedInformation", t.diffOmittedPrior],
                  ].map(([key, label]) => (
                    <div key={key} className="pre-visit-case-detail__diff-block">
                      <strong>{label}</strong>
                      <p>
                        {(diffResult[key] || []).length
                          ? diffResult[key].join(" | ")
                          : tDoc.empty}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="pre-visit-case-detail__section" aria-labelledby="case-continuity-heading">
              <h2 id="case-continuity-heading" className="pre-visit-case-detail__section-title">
                {t.continuityTitle}
              </h2>
              <p className="pre-visit-case-detail__hint">{t.continuityHint}</p>
              <button
                type="button"
                className="pre-visit-case-detail__btn pre-visit-case-detail__btn--primary"
                disabled={continuityBusy || timeline.length < 2}
                onClick={() => void generateContinuity()}
              >
                {continuityBusy ? t.continuityBusy : t.continuityGenerate}
              </button>
              {continuity ? (
                <div className="pre-visit-case-detail__continuity">
                  {[
                    ["recurringSymptoms", t.continuitySymptoms],
                    ["recurringMedications", t.continuityMeds],
                    ["recurringPatientQuestions", t.continuityQuestions],
                    ["recurringConcerns", t.continuityConcerns],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <strong>{label}</strong>
                      <p>{(continuity[key] || []).join(" | ") || tDoc.empty}</p>
                    </div>
                  ))}
                  <button type="button" className="pre-visit-case-detail__btn" onClick={pushContinuityToPreparation}>
                    {t.continuityToPrep}
                  </button>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
