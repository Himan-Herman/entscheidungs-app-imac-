import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { authFetch } from "../api/authFetch.js";
import { generatePreVisitPdf } from "../features/preVisit/pdf/generatePreVisitPdf.js";
import { PRE_VISIT_QUESTION_STEPS, pickLocalized } from "../features/preVisit/constants/questionFlow.js";
import { STRUCTURED_SECTION_ORDER, STRUCTURED_DOCTOR_LABELS } from "../features/preVisit/constants/structuredDoctorLabels.js";
import "../styles/PracticeDashboardPage.css";
import VisitMedicationEditor from "../features/visitMedications/components/VisitMedicationEditor.jsx";
import { getPrimaryIntlLocale } from '../i18n/intlLocale.js';

const STATUSES = ["new", "opened", "in_review", "completed", "archived"];

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function PracticePreparationDetailPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceDashboard || getMessages("en").practiceDashboard,
    [language],
  );
  const tMeds = useMemo(
    () => getMessages(language).visitMedications || getMessages("en").visitMedications,
    [language],
  );
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const practiceId = useMemo(
    () => new URLSearchParams(location.search).get("practiceId") || "",
    [location.search],
  );

  const [row, setRow] = useState(null);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("opened");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveInfo, setSaveInfo] = useState("");
  const [threads, setThreads] = useState([]);
  const [followUpLoadError, setFollowUpLoadError] = useState("");
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newMessageBody, setNewMessageBody] = useState("");
  const [sendBodyByThread, setSendBodyByThread] = useState({});
  const [includeFollowUpsInPdf, setIncludeFollowUpsInPdf] = useState(false);

  function statusLabel(v) {
    if (v === "new") return t.statusNew;
    if (v === "opened") return t.statusOpened;
    if (v === "in_review") return t.statusInReview;
    if (v === "completed") return t.statusCompleted;
    if (v === "archived") return t.statusArchived;
    return v;
  }

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    if (!id || !practiceId) return;
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await authFetch(
          `/api/practice-dashboard/preparations/${encodeURIComponent(id)}?practiceId=${encodeURIComponent(practiceId)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error("load_failed");
        if (!active) return;
        setRow(data.preparation || null);
        setRole(String(data.role || ""));
        setStatus(String(data.preparation?.practiceStatus || "opened"));
      } catch (e) {
        if (e?.message === "SESSION_EXPIRED") return;
        if (!active) return;
        setError(t.loadError);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, practiceId, t.loadError]);

  const loadFollowUps = useCallback(async () => {
    if (!practiceId || !id) return;
    setFollowUpLoadError("");
    try {
      const q = new URLSearchParams();
      q.set("practiceId", practiceId);
      const res = await authFetch(`/api/practice/follow-ups?${q.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("load_followups_failed");
      const list = Array.isArray(data.threads) ? data.threads : [];
      setThreads(list.filter((th) => th.preVisitSessionId === id));
    } catch (e) {
      if (e?.message !== "SESSION_EXPIRED") setFollowUpLoadError(t.followUpLoadError);
      setThreads([]);
    }
  }, [id, practiceId, t.followUpLoadError]);

  useEffect(() => {
    void loadFollowUps();
  }, [loadFollowUps]);

  async function updateStatus(nextStatus) {
    if (!row) return;
    setSaveInfo("");
    try {
      const res = await authFetch(`/api/practice-dashboard/preparations/${encodeURIComponent(row.id)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceId, practiceStatus: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("save_failed");
      setRow(data.preparation || row);
      setStatus(String(data.preparation?.practiceStatus || nextStatus));
      setSaveInfo(t.detailStatusSaved);
    } catch {
      setSaveInfo(t.detailStatusError);
    }
  }

  async function archiveRow() {
    if (!row) return;
    try {
      const res = await authFetch(
        `/api/practice-dashboard/preparations/${encodeURIComponent(row.id)}?practiceId=${encodeURIComponent(practiceId)}&mode=archive`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("archive_failed");
      await updateStatus("archived");
    } catch {
      setSaveInfo(t.detailArchiveError);
    }
  }

  async function deleteRow() {
    if (!row) return;
    if (!window.confirm(t.detailDeleteConfirm)) return;
    try {
      const res = await authFetch(`/api/practice-dashboard/preparations/${encodeURIComponent(row.id)}?practiceId=${encodeURIComponent(practiceId)}&mode=delete`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete_failed");
      navigate(`/practice/dashboard?practiceId=${encodeURIComponent(practiceId)}`);
    } catch {
      setSaveInfo(t.detailDeleteError);
    }
  }

  async function createFollowUpThread() {
    if (!newMessageBody.trim()) return;
    try {
      const res = await authFetch("/api/practice/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceId,
          preVisitSessionId: id,
          title: newThreadTitle.trim(),
          message: newMessageBody.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("followup_create_failed");
      setNewThreadTitle("");
      setNewMessageBody("");
      await loadFollowUps();
    } catch {
      setSaveInfo(t.followUpCreateError);
    }
  }

  async function sendFollowUpMessage(threadId) {
    const body = String(sendBodyByThread[threadId] || "").trim();
    if (!body) return;
    try {
      const res = await authFetch(`/api/practice/follow-ups/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceId, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("followup_send_failed");
      setSendBodyByThread((prev) => ({ ...prev, [threadId]: "" }));
      await loadFollowUps();
    } catch {
      setSaveInfo(t.followUpSendError);
    }
  }

  async function updateFollowUpStatus(threadId, nextStatus) {
    try {
      const res = await authFetch(`/api/practice/follow-ups/${encodeURIComponent(threadId)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceId, status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("followup_status_failed");
      setSaveInfo(t.followUpStatusSaved);
      await loadFollowUps();
    } catch {
      setSaveInfo(t.followUpStatusError);
    }
  }

  function downloadPdf() {
    if (!row?.answers) return;
    const followupMessages = includeFollowUpsInPdf
      ? threads
          .flatMap((th) => (Array.isArray(th.messages) ? th.messages : []))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      : [];
    generatePreVisitPdf({
      session: {
        answers: row.answers,
        aiDoctorVersion: row.aiDoctorVersion,
        aiSafetyNotice: row.aiSafetyNotice,
        patientLanguage: row.patientLanguage || "de",
        doctorLanguage: row.doctorLanguage || row.patientLanguage || "de",
        followUpHistory: {
          includeInPdf: includeFollowUpsInPdf,
          messages: followupMessages,
        },
      },
      uiLanguage: language,
      labels: {},
    });
  }

  if (loading) return <div className="practice-dashboard"><div className="practice-dashboard__inner"><p>{t.loading}</p></div></div>;
  if (error || !row) return <div className="practice-dashboard"><div className="practice-dashboard__inner"><p className="practice-dashboard__error">{error || t.loadError}</p></div></div>;

  const canWrite = ["owner", "admin", "doctor", "assistant"].includes(role);
  const canDelete = ["owner", "admin"].includes(role);
  const answers = row.answers && typeof row.answers === "object" ? row.answers : {};
  const patientIdentity = answers.patientIdentity && typeof answers.patientIdentity === "object" ? answers.patientIdentity : null;
  const timeline = answers.caseTimeline && typeof answers.caseTimeline === "object" ? answers.caseTimeline : null;
  const patientLang = row.patientLanguage || "de";
  const structured = row.aiDoctorVersion && typeof row.aiDoctorVersion === "object" ? row.aiDoctorVersion : null;

  return (
    <div className="practice-dashboard">
      <div className="practice-dashboard__inner">
        <Link className="practice-dashboard__back" to={`/practice/dashboard?practiceId=${encodeURIComponent(practiceId)}`}>
          {t.detailBack}
        </Link>
        <h1 className="practice-dashboard__title">{t.detailTitle}</h1>
        <p className="practice-dashboard__role">{t.memberRoleLabel}: <strong>{role}</strong></p>

        <section className="practice-dashboard__card">
          <h2>{t.detailMeta}</h2>
          <p>{row.patientName || "—"}</p>
          <p>{fmt(row.createdAt, language)}</p>
          <p>{row.targetDoctorName || row.targetName || "—"}</p>
          <p>{row.preVisitCaseTitle || "—"}</p>
          <p>{statusLabel(row.practiceStatus)}</p>
          <button type="button" onClick={downloadPdf}>{t.detailDownloadPdf}</button>
          <Link to="/pre-visit/document">{t.detailOpenPatientFlow}</Link>
        </section>

        <section className="practice-dashboard__card">
          <h2>{t.detailStatusLabel}</h2>
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canWrite}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <div className="practice-dashboard__card-top">
            <button type="button" onClick={() => void updateStatus(status)} disabled={!canWrite}>
              {t.detailSaveStatus}
            </button>
            {canDelete ? <button type="button" onClick={() => void archiveRow()}>{t.detailArchive}</button> : null}
            {canDelete ? <button type="button" onClick={() => void deleteRow()}>{t.detailDelete}</button> : null}
          </div>
          {saveInfo ? <p>{saveInfo}</p> : null}
        </section>

        <section className="practice-dashboard__card practice-dashboard__card--medications">
          <VisitMedicationEditor
            sessionId={row.id}
            practiceId={practiceId}
            t={tMeds}
            canWrite={canWrite}
          />
        </section>

        <section className="practice-dashboard__card">
          <h2>{t.followUpsTitle}</h2>
          {followUpLoadError ? <p className="practice-dashboard__error">{followUpLoadError}</p> : null}
          {canWrite ? (
            <div className="practice-dashboard__followup-create">
              <label>
                {t.followUpThreadTitle}
                <input
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                />
              </label>
              <label>
                {t.followUpMessageLabel}
                <textarea
                  rows={3}
                  value={newMessageBody}
                  onChange={(e) => setNewMessageBody(e.target.value)}
                />
              </label>
              <button type="button" onClick={() => void createFollowUpThread()}>
                {t.askFollowUp}
              </button>
            </div>
          ) : null}
          <label className="practice-dashboard__pdf-toggle">
            <input
              type="checkbox"
              checked={includeFollowUpsInPdf}
              onChange={(e) => setIncludeFollowUpsInPdf(e.target.checked)}
            />
            <span>{t.includeFollowUpsInPdf}</span>
          </label>
          {threads.length === 0 ? <p>{t.followUpEmpty}</p> : null}
          {threads.map((th) => (
            <article key={th.id} className="practice-dashboard__followup-thread">
              <p><strong>{th.title || t.followUpsTitle}</strong></p>
              <p><strong>{t.followUpStatusLabel}:</strong> {th.status}</p>
              {canWrite ? (
                <select
                  value={th.status}
                  onChange={(e) => void updateFollowUpStatus(th.id, e.target.value)}
                >
                  <option value="open">open</option>
                  <option value="waiting_for_patient">{t.waitingForPatient}</option>
                  <option value="answered">{t.answered}</option>
                  <option value="closed">{t.closed}</option>
                  <option value="archived">{t.threadArchived}</option>
                </select>
              ) : null}
              <div className="practice-dashboard__followup-messages">
                {(Array.isArray(th.messages) ? th.messages : []).map((m) => (
                  <p key={m.id}>
                    <strong>{m.senderType}</strong> · {fmt(m.createdAt, language)} — {m.body}
                  </p>
                ))}
              </div>
              {canWrite ? (
                <div className="practice-dashboard__followup-reply">
                  <textarea
                    rows={2}
                    value={sendBodyByThread[th.id] || ""}
                    onChange={(e) =>
                      setSendBodyByThread((prev) => ({ ...prev, [th.id]: e.target.value }))
                    }
                  />
                  <button type="button" onClick={() => void sendFollowUpMessage(th.id)}>
                    {t.sendMessage}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>

        <section className="practice-dashboard__card">
          <h2>{t.detailStructured}</h2>
          {structured ? STRUCTURED_SECTION_ORDER.map((key) => (
            <p key={key}>
              <strong>{(STRUCTURED_DOCTOR_LABELS[key]?.[language]) || key}:</strong>{" "}
              {String(structured[key] || "").trim() || "—"}
            </p>
          )) : <p>{t.detailNoStructured}</p>}
        </section>

        <section className="practice-dashboard__card">
          <h2>{t.detailOriginal}</h2>
          {PRE_VISIT_QUESTION_STEPS.map((step) => (
            <p key={step.key}>
              <strong>{pickLocalized(step.title, patientLang)}:</strong>{" "}
              {String(answers[step.key] || "").trim() || "—"}
            </p>
          ))}
        </section>

        <section className="practice-dashboard__card">
          <h2>{t.detailIdentity}</h2>
          {patientIdentity ? (
            <>
              <p><strong>Name:</strong> {String(patientIdentity.patientName || "").trim() || "—"}</p>
              <p><strong>Email:</strong> {String(patientIdentity.patientEmail || "").trim() || "—"}</p>
              <p><strong>Phone:</strong> {String(patientIdentity.patientPhone || "").trim() || "—"}</p>
              <p><strong>DOB:</strong> {String(patientIdentity.patientDateOfBirth || "").trim() || "—"}</p>
            </>
          ) : <p>{t.detailNoIdentity}</p>}
        </section>

        <section className="practice-dashboard__card">
          <h2>{t.detailTimeline}</h2>
          {timeline?.summary ? (
            <>
              <p><strong>Newly mentioned:</strong> {(timeline.summary.newlyMentioned || []).join(" | ") || "—"}</p>
              <p><strong>Still mentioned:</strong> {(timeline.summary.stillMentioned || []).join(" | ") || "—"}</p>
              <p><strong>No longer mentioned:</strong> {(timeline.summary.noLongerMentioned || []).join(" | ") || "—"}</p>
              <p><strong>Unclear:</strong> {(timeline.summary.unclear || []).join(" | ") || "—"}</p>
              <p><strong>Patient added new information:</strong> {(timeline.summary.patientAddedNewInformation || []).join(" | ") || "—"}</p>
            </>
          ) : <p>{t.detailNoTimeline}</p>}
        </section>
      </div>
    </div>
  );
}
