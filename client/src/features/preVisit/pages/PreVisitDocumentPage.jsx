import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages.js";
import {
  PRE_VISIT_QUESTION_STEPS,
  pickLocalized,
} from "../constants/questionFlow.js";
import { STRUCTURED_SECTION_ORDER } from "../constants/structuredDoctorLabels.js";
import {
  computePreVisitAiFingerprint,
  isAiDoctorVersionFresh,
  loadPreVisitSession,
  normalizeLongitudinalCase,
  savePreVisitSession,
  setCaseTimelineData,
  setLongitudinalCaseData,
  setOptionalPatientIdentity,
  setDoctorLanguage,
  setSelectedDoctorContact,
} from "../constants/preVisitSession.js";
import { apiFetch } from "../../../lib/api.js";
import { authFetch } from "../../../api/authFetch.js";
import { detectDeviceType, sendPracticeAnalyticsEvent } from "../../../api/productAnalytics.js";
import {
  buildPreVisitPdfBlob,
  generatePreVisitPdf,
  getPreVisitPdfFilename,
} from "../pdf/generatePreVisitPdf.js";
import { savePreVisitArchiveItem } from "../session/localPreVisitArchive.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitDocumentPage.css";

export default function PreVisitDocumentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).preVisit.document, [language]);
  const tCaseDetail = useMemo(
    () => getMessages(language).preVisit.caseDetail,
    [language],
  );
  const pdfLabelOverrides = useMemo(
    () => ({
      patientAddedNewInformationLabel: t.timelinePatientAddedNewInformation,
      patientDidNotMentionPreviouslyLabel: t.timelinePatientDidNotMentionPrior,
      longitudinalSectionHeading: t.longitudinalPdfSection,
      longitudinalSectionNote: t.longitudinalPdfNote,
      longitudinalCaseTitlePdfLabel: t.longitudinalPdfCaseTitle,
      longitudinalContinuitySubheading: t.longitudinalPdfContinuity,
      continuityRecurringSymptomsLabel: tCaseDetail.continuitySymptoms,
      continuityRecurringMedicationsLabel: tCaseDetail.continuityMeds,
      continuityRecurringQuestionsLabel: tCaseDetail.continuityQuestions,
      continuityRecurringConcernsLabel: tCaseDetail.continuityConcerns,
      longitudinalSessionsOverviewHeading: t.longitudinalPdfSessionsOverview,
      longitudinalRelatedReportsHeading: t.longitudinalPdfRelatedReports,
    }),
    [t, tCaseDetail],
  );

  const [session, setSession] = useState(() => loadPreVisitSession());
  const [consentLocalSave, setConsentLocalSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [consentAccountSave, setConsentAccountSave] = useState(false);
  const [accountSaveSuccess, setAccountSaveSuccess] = useState(false);
  const [accountSaveError, setAccountSaveError] = useState(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [hasAuthToken, setHasAuthToken] = useState(() =>
    typeof window !== "undefined"
      ? !!window.localStorage.getItem("medscout_token")
      : false
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSuccessNote, setAiSuccessNote] = useState(null);

  const [doctorContacts, setDoctorContacts] = useState([]);
  const [doctorContactsLoading, setDoctorContactsLoading] = useState(false);
  const [consentEmailPdf, setConsentEmailPdf] = useState(false);
  const [emailPdfSending, setEmailPdfSending] = useState(false);
  const [emailPdfSuccess, setEmailPdfSuccess] = useState(false);
  const [emailPdfError, setEmailPdfError] = useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [patientIdentity, setPatientIdentity] = useState(() => {
    const s = loadPreVisitSession();
    const p = s?.patientIdentity || {};
    return {
      patientName: String(p.patientName || ""),
      patientEmail: String(p.patientEmail || ""),
      patientDateOfBirth: String(p.patientDateOfBirth || ""),
      patientGenderOrSalutation: String(p.patientGenderOrSalutation || ""),
      patientPhone: String(p.patientPhone || ""),
    };
  });
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState(null);
  const [timelineSessions, setTimelineSessions] = useState([]);
  const [timelineBusy, setTimelineBusy] = useState(false);
  const [longitudinalOverviewBusy, setLongitudinalOverviewBusy] = useState(false);
  const [longitudinalPdfErr, setLongitudinalPdfErr] = useState(null);
  const [caseTimeline, setCaseTimeline] = useState(() => {
    const s = loadPreVisitSession();
    const c = s?.caseTimeline || {};
    return {
      relatedSessionId: String(c.relatedSessionId || ""),
      caseTopic: String(c.caseTopic || ""),
      includeInPdf: Boolean(c.includeInPdf),
      summary:
        c.summary && typeof c.summary === "object"
          ? c.summary
          : null,
    };
  });

  useEffect(() => {
    const s = loadPreVisitSession();
    if (!s?.answers) {
      navigate("/pre-visit", { replace: true });
      return;
    }
    const preferredFromPractice = String(
      s?.practiceContext?.preferredDoctorLanguage || ""
    ).trim();
    if (!s.doctorLanguage) {
      setDoctorLanguage(preferredFromPractice || s.patientLanguage || "de");
      setSession(loadPreVisitSession());
      return;
    }
    setSession(s);
    const p = s?.patientIdentity || {};
    setPatientIdentity({
      patientName: String(p.patientName || ""),
      patientEmail: String(p.patientEmail || ""),
      patientDateOfBirth: String(p.patientDateOfBirth || ""),
      patientGenderOrSalutation: String(p.patientGenderOrSalutation || ""),
      patientPhone: String(p.patientPhone || ""),
    });
    const c = s?.caseTimeline || {};
    setCaseTimeline({
      relatedSessionId: String(c.relatedSessionId || ""),
      caseTopic: String(c.caseTopic || ""),
      includeInPdf: Boolean(c.includeInPdf),
      summary:
        c.summary && typeof c.summary === "object"
          ? c.summary
          : null,
    });
  }, [location.pathname, location.key, navigate]);

  useEffect(() => {
    setHasAuthToken(!!localStorage.getItem("medscout_token"));
  }, [location.pathname, location.key]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  const patientLang = session?.patientLanguage || "de";

  const doctorLang = useMemo(() => {
    const fromSession = session?.doctorLanguage;
    if (fromSession) return fromSession;
    return patientLang;
  }, [session?.doctorLanguage, patientLang]);

  const langOptions = useMemo(
    () =>
      PRE_VISIT_LANGUAGE_OPTIONS.map((row) => ({
        value: row.id,
        label: formatLanguageDisplayName(language, row.id),
      })),
    [language]
  );

  const longitudinalUi = useMemo(
    () => normalizeLongitudinalCase(session?.longitudinalCase),
    [session?.longitudinalCase],
  );

  const loadDoctorContacts = useCallback(async () => {
    if (!hasAuthToken) {
      setDoctorContacts([]);
      return;
    }
    setDoctorContactsLoading(true);
    try {
      const res = await authFetch("/api/user/doctor-contacts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("load_failed");
      setDoctorContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setDoctorContacts([]);
    } finally {
      setDoctorContactsLoading(false);
    }
  }, [hasAuthToken]);

  useEffect(() => {
    void loadDoctorContacts();
  }, [loadDoctorContacts]);

  useEffect(() => {
    if (!hasAuthToken || doctorContactsLoading) return;
    const sel = session?.selectedDoctorContactId;
    if (!sel) return;
    if (!doctorContacts.some((c) => c.id === sel)) {
      const next = setSelectedDoctorContact(null);
      setSession(next ?? loadPreVisitSession());
    }
  }, [
    hasAuthToken,
    doctorContactsLoading,
    doctorContacts,
    session?.selectedDoctorContactId,
  ]);

  function handleDoctorRecipientChange(e) {
    const v = e.target.value;
    const next = setSelectedDoctorContact(v === "" ? null : v);
    setSession(next ?? loadPreVisitSession());
    setEmailPdfError(null);
    setEmailPdfSuccess(false);
  }

  function handlePatientIdentityFieldChange(field, value) {
    const nextIdentity = { ...patientIdentity, [field]: value };
    setPatientIdentity(nextIdentity);
    const next = setOptionalPatientIdentity(nextIdentity);
    if (next) setSession(next);
  }

  const loadTimelineSessions = useCallback(async () => {
    if (!hasAuthToken) {
      setTimelineSessions([]);
      return;
    }
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const res = await authFetch("/api/previsit/sessions");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.sessions)) {
        setTimelineError(t.timelineLoadError);
        setTimelineSessions([]);
        return;
      }
      setTimelineSessions(data.sessions);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setTimelineError(t.timelineLoadError);
      setTimelineSessions([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [hasAuthToken, t.timelineLoadError]);

  useEffect(() => {
    void loadTimelineSessions();
  }, [loadTimelineSessions]);

  function updateCaseTimeline(patch) {
    const nextRaw = { ...caseTimeline, ...patch };
    setCaseTimeline(nextRaw);
    const next = setCaseTimelineData(nextRaw);
    if (next) setSession(next);
  }

  function patchLongitudinalPdfInclude(partial) {
    setLongitudinalPdfErr(null);
    const next = setLongitudinalCaseData({ pdfInclude: partial });
    if (next) setSession(next);
  }

  async function handleLoadSessionsOverview() {
    const cid = longitudinalUi?.caseId;
    if (!cid || !hasAuthToken) return;
    setLongitudinalOverviewBusy(true);
    setLongitudinalPdfErr(null);
    try {
      const res = await authFetch(
        `/api/previsit/cases/${encodeURIComponent(cid)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.case?.sessions) {
        setLongitudinalPdfErr(t.longitudinalLoadOverviewError);
        return;
      }
      const localeTag = language === "de" ? "de-DE" : "en-GB";
      const lines = data.case.sessions.map((s) => {
        const d = new Date(s.createdAt);
        const ds = Number.isNaN(d.getTime())
          ? "—"
          : new Intl.DateTimeFormat(localeTag, {
              dateStyle: "medium",
            }).format(d);
        const reason = String(s.appointmentReasonPreview || "").trim();
        return `${ds} — ${reason || "—"}`;
      });
      const next = setLongitudinalCaseData({
        sessionsOverviewLines: lines,
        caseTitle: String(data.case.title || longitudinalUi.caseTitle || ""),
      });
      if (next) setSession(next);
    } catch (e) {
      if (e?.message !== "SESSION_EXPIRED") {
        setLongitudinalPdfErr(t.longitudinalLoadOverviewError);
      }
    } finally {
      setLongitudinalOverviewBusy(false);
    }
  }

  async function handleGenerateTimelineSummary() {
    if (!caseTimeline.relatedSessionId) {
      setTimelineError(t.timelineSelectCaseFirst);
      return;
    }
    const previous = timelineSessions.find(
      (row) => row.id === caseTimeline.relatedSessionId
    );
    if (!previous?.answers || !session?.answers) {
      setTimelineError(t.timelineLoadError);
      return;
    }
    setTimelineBusy(true);
    setTimelineError(null);
    try {
      const data = await apiFetch("/api/previsit/history-diff", {
        method: "POST",
        body: JSON.stringify({
          previousAnswers: previous.answers,
          currentAnswers: session.answers,
          patientLanguage: session.patientLanguage,
          doctorLanguage: doctorLang,
        }),
      });
      const summary = {
        newlyMentioned: Array.isArray(data?.newlyMentioned)
          ? data.newlyMentioned
          : [],
        stillMentioned: Array.isArray(data?.stillMentioned)
          ? data.stillMentioned
          : [],
        noLongerMentioned: Array.isArray(data?.noLongerMentioned)
          ? data.noLongerMentioned
          : [],
        unclear: Array.isArray(data?.unclear) ? data.unclear : [],
        patientAddedNewInformation: Array.isArray(
          data?.patientAddedNewInformation,
        )
          ? data.patientAddedNewInformation
          : [],
        patientDidNotMentionPreviouslyReportedInformation: Array.isArray(
          data?.patientDidNotMentionPreviouslyReportedInformation,
        )
          ? data.patientDidNotMentionPreviouslyReportedInformation
          : [],
      };
      updateCaseTimeline({ summary });
    } catch {
      setTimelineError(t.timelineSummaryError);
    } finally {
      setTimelineBusy(false);
    }
  }

  async function handleSendPdfEmail() {
    setEmailPdfError(null);
    setEmailPdfSuccess(false);
    const contactId = session?.selectedDoctorContactId;
    if (!contactId) {
      setEmailPdfError(t.emailPdfRequiresDoctor);
      return;
    }
    if (!consentEmailPdf) {
      setEmailPdfError(t.emailPdfRequiresConsent);
      return;
    }
    const contact = doctorContacts.find((c) => c.id === contactId);
    if (!contact?.email?.trim()) {
      setEmailPdfError(t.doctorRecipientEmailMissing);
      return;
    }
    const latest = loadPreVisitSession();
    if (!latest?.answers) return;
    const blob = buildPreVisitPdfBlob({
      session: latest,
      uiLanguage: language,
      labels: pdfLabelOverrides,
    });
    if (!blob) {
      setEmailPdfError(t.emailPdfNoPdf);
      return;
    }
    setEmailPdfSending(true);
    try {
      const fd = new FormData();
      fd.append("pdf", blob, getPreVisitPdfFilename(language));
      fd.append("emailSendConsent", "true");
      fd.append("locale", language);
      const storedId = String(loadPreVisitSession()?.cloudSessionId || "").trim();
      if (storedId) fd.append("preVisitSessionId", storedId);
      const res = await authFetch(
        `/api/user/doctor-contacts/${encodeURIComponent(contactId)}/send-previsit-pdf`,
        { method: "POST", body: fd }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.message === "string" && data.message.trim()
            ? data.message
            : t.emailPdfError;
        setEmailPdfError(msg);
        return;
      }
      setEmailPdfSuccess(true);
      setConsentEmailPdf(false);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setEmailPdfError(t.emailPdfError);
    } finally {
      setEmailPdfSending(false);
    }
  }

  function handleDoctorLangChange(e) {
    const code = e.target.value;
    setAiError(null);
    setAiSuccessNote(null);
    const next = setDoctorLanguage(code);
    setSession(next ?? loadPreVisitSession());
  }

  async function handleCreateDoctorVersion() {
    if (!session?.answers) return;

    const dl = doctorLang;
    if (isAiDoctorVersionFresh(session)) {
      setAiError(null);
      setAiSuccessNote(t.aiSuccessStatus);
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSuccessNote(null);

    try {
      const data = await apiFetch("/api/previsit/doctor-version", {
        method: "POST",
        body: JSON.stringify({
          patientLanguage: session.patientLanguage,
          doctorLanguage: dl,
          answers: session.answers,
        }),
      });

      const fpSession = loadPreVisitSession() || session;
      const next = {
        ...fpSession,
        aiDoctorVersion: data.doctorVersion,
        aiSafetyNotice:
          typeof data.safetyNotice === "string" ? data.safetyNotice : "",
        aiDoctorVersionFingerprint: computePreVisitAiFingerprint(
          fpSession.answers,
          dl
        ),
      };
      savePreVisitSession(next);
      setSession(next);
      setAiSuccessNote(t.aiSuccessStatus);
    } catch {
      setAiError(t.aiError);
    } finally {
      setAiLoading(false);
    }
  }

  function structuredHeading(key) {
    const labels = t.structuredRowLabels;
    return labels[key] || "";
  }

  function handleDownloadPdf() {
    const latest = loadPreVisitSession();
    if (!latest?.answers) return;
    try {
      const ok = generatePreVisitPdf({
        session: latest,
        uiLanguage: language,
        labels: pdfLabelOverrides,
      });
      if (!ok) return;
      const next = { ...latest, pdfDownloaded: true };
      savePreVisitSession(next);
      setSession(next);
    } catch {
      /* PDF generation failed — do not set pdfDownloaded */
    }
  }

  async function handleOpenQrShare() {
    setQrBusy(true);
    setQrError(null);
    try {
      const QRCode = (await import("qrcode")).default;
      const site =
        (typeof import.meta.env.VITE_SITE_URL === "string" &&
          import.meta.env.VITE_SITE_URL.trim()) ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const payload = `${site}\n\n${t.qrSharePayloadNote}`;
      const url = await QRCode.toDataURL(payload, { margin: 2, width: 280 });
      setQrDataUrl(url);
      setQrModalOpen(true);
    } catch {
      setQrError(t.qrShareGenerateError);
    } finally {
      setQrBusy(false);
    }
  }

  useEffect(() => {
    if (!qrModalOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setQrModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qrModalOpen]);

  async function handleSaveToAccount() {
    if (!consentAccountSave || !hasAuthToken) return;

    setAccountSaving(true);
    setAccountSaveError(null);
    setAccountSaveSuccess(false);

    try {
      const latest = loadPreVisitSession();
      if (!latest?.answers || typeof latest.answers !== "object") {
        setAccountSaveError(t.accountSaveError);
        return;
      }

      const dl =
        latest.doctorLanguage || latest.patientLanguage || doctorLang;
      const normalizedPatientIdentity = {
        patientName: String(latest?.patientIdentity?.patientName || "").trim(),
        patientDateOfBirth: String(
          latest?.patientIdentity?.patientDateOfBirth || ""
        ).trim(),
        patientEmail: String(latest?.patientIdentity?.patientEmail || "").trim(),
        patientPhone: String(latest?.patientIdentity?.patientPhone || "").trim(),
        patientGenderOrSalutation: String(
          latest?.patientIdentity?.patientGenderOrSalutation || ""
        ).trim(),
      };
      const hasPatientIdentity = Object.values(normalizedPatientIdentity).some(
        (v) => v.length > 0
      );
      const answersForAccount = hasPatientIdentity
        ? { ...latest.answers, patientIdentity: normalizedPatientIdentity }
        : { ...latest.answers };
      const timelineSummary = latest?.caseTimeline?.summary;
      const timelinePayload =
        latest?.caseTimeline?.relatedSessionId &&
        timelineSummary &&
        typeof timelineSummary === "object"
          ? {
              caseTimeline: {
                relatedSessionId: String(
                  latest.caseTimeline.relatedSessionId || ""
                ),
                caseTopic: String(latest.caseTimeline.caseTopic || ""),
                includeInPdf: Boolean(latest.caseTimeline.includeInPdf),
                summary: {
                  newlyMentioned: Array.isArray(
                    timelineSummary.newlyMentioned
                  )
                    ? timelineSummary.newlyMentioned
                    : [],
                  stillMentioned: Array.isArray(timelineSummary.stillMentioned)
                    ? timelineSummary.stillMentioned
                    : [],
                  noLongerMentioned: Array.isArray(
                    timelineSummary.noLongerMentioned
                  )
                    ? timelineSummary.noLongerMentioned
                    : [],
                  unclear: Array.isArray(timelineSummary.unclear)
                    ? timelineSummary.unclear
                    : [],
                  patientAddedNewInformation: Array.isArray(
                    timelineSummary.patientAddedNewInformation,
                  )
                    ? timelineSummary.patientAddedNewInformation
                    : [],
                  patientDidNotMentionPreviouslyReportedInformation:
                    Array.isArray(
                      timelineSummary.patientDidNotMentionPreviouslyReportedInformation,
                    )
                      ? timelineSummary.patientDidNotMentionPreviouslyReportedInformation
                      : [],
                },
              },
            }
          : {};
      const answersForAccountWithTimeline = {
        ...answersForAccount,
        ...timelinePayload,
      };

      const caseLinkId =
        normalizeLongitudinalCase(latest.longitudinalCase)?.caseId || "";

      const payload = {
        patientLanguage: latest.patientLanguage || "de",
        doctorLanguage: dl || null,
        answers: answersForAccountWithTimeline,
        aiDoctorVersion: latest.aiDoctorVersion ?? null,
        aiSafetyNotice:
          typeof latest.aiSafetyNotice === "string" &&
          latest.aiSafetyNotice.trim()
            ? latest.aiSafetyNotice.trim()
            : null,
        title: language === "de" ? t.sessionTitleDe : t.sessionTitleEn,
        status: latest.pdfDownloaded ? "pdf_created" : "draft",
        pdfDownloaded: !!latest.pdfDownloaded,
        ...(caseLinkId ? { preVisitCaseId: caseLinkId } : {}),
      };

      const res = await authFetch("/api/previsit/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAccountSaveError(t.accountSaveError);
        return;
      }

      const sid = data.session?.id;
      if (typeof sid === "string" && sid.length > 0) {
        const latest = loadPreVisitSession();
        const merged = { ...latest, cloudSessionId: sid };
        savePreVisitSession(merged);
        setSession(merged);
        void sendPracticeAnalyticsEvent({
          eventType: "previsit_saved_to_account",
          sessionId: sid,
          metadata: {
            source: "account",
            deviceType: detectDeviceType(),
            uiLanguage: language,
          },
        });
      }

      setAccountSaveSuccess(true);
      setConsentAccountSave(false);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setAccountSaveError(t.accountSaveError);
    } finally {
      setAccountSaving(false);
    }
  }

  function handleSaveArchive() {
    if (!consentLocalSave) return;
    const latest = loadPreVisitSession();
    if (!latest?.answers) return;
    try {
      savePreVisitArchiveItem(latest);
      setSaveSuccess(true);
      setConsentLocalSave(false);
    } catch {
      setSaveSuccess(false);
    }
  }

  if (!session?.answers) {
    return null;
  }

  const aiFresh = isAiDoctorVersionFresh(session);
  const structuredSource =
    aiFresh && session.aiDoctorVersion
      ? session.aiDoctorVersion
      : session.answers;

  const selectedDoctorRecipientValue = session.selectedDoctorContactId
    ? String(session.selectedDoctorContactId)
    : "";
  const selectedContactForRecipient = doctorContacts.find(
    (c) => c.id === selectedDoctorRecipientValue
  );

  return (
    <div className="pre-visit-doc">
      <div className="pre-visit-doc__inner">
        <PreVisitModuleChrome />
        <header className="pre-visit-doc__header">
          <h1 className="pre-visit-doc__title">{t.title}</h1>
          <p className="pre-visit-doc__lead">{t.explanation}</p>
        </header>

        <div className="pre-visit-doc__field">
          {session?.practiceContext?.practiceName ? (
            <div className="pre-visit-doc__timeline-summary">
              <p className="pre-visit-doc__timeline-title">{t.practiceContextTitle}</p>
              <p className="pre-visit-doc__timeline-line">
                <strong>{t.practiceContextPractice}: </strong>
                {session.practiceContext.practiceName}
              </p>
              {session.practiceContext.targetName ? (
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.practiceContextTarget}: </strong>
                  {session.practiceContext.targetName}
                </p>
              ) : null}
              {session.practiceContext.doctorName ? (
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.practiceContextDoctor}: </strong>
                  {session.practiceContext.doctorName}
                </p>
              ) : null}
              {session.practiceContext.specialty ? (
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.practiceContextSpecialty}: </strong>
                  {session.practiceContext.specialty}
                </p>
              ) : null}
            </div>
          ) : null}
          <label className="pre-visit-doc__label" htmlFor="previsit-doctor-lang">
            {t.doctorLangLabel}
          </label>
          <select
            id="previsit-doctor-lang"
            className="pre-visit-doc__select"
            value={doctorLang}
            onChange={handleDoctorLangChange}
            aria-describedby="previsit-doctor-lang-hint"
          >
            {langOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p id="previsit-doctor-lang-hint" className="pre-visit-doc__field-hint">
            {t.doctorLangHint}
          </p>
        </div>

        <div className="pre-visit-doc__field pre-visit-doc__field--identity">
          <h2 className="pre-visit-doc__recipient-heading">{t.patientMetaSection}</h2>
          <p className="pre-visit-doc__field-hint">{t.patientMetaNote}</p>
          <label className="pre-visit-doc__label" htmlFor="previsit-patient-name">
            {t.patientNameLabel}
          </label>
          <input
            id="previsit-patient-name"
            className="pre-visit-doc__input"
            type="text"
            value={patientIdentity.patientName}
            onChange={(e) =>
              handlePatientIdentityFieldChange("patientName", e.target.value)
            }
            autoComplete="name"
          />
          <label className="pre-visit-doc__label" htmlFor="previsit-patient-email">
            {t.patientEmailLabel}
          </label>
          <input
            id="previsit-patient-email"
            className="pre-visit-doc__input"
            type="email"
            value={patientIdentity.patientEmail}
            onChange={(e) =>
              handlePatientIdentityFieldChange("patientEmail", e.target.value)
            }
            autoComplete="email"
          />
          <label className="pre-visit-doc__label" htmlFor="previsit-patient-dob">
            {t.patientDateOfBirthLabel}
          </label>
          <input
            id="previsit-patient-dob"
            className="pre-visit-doc__input"
            type="date"
            value={patientIdentity.patientDateOfBirth}
            onChange={(e) =>
              handlePatientIdentityFieldChange(
                "patientDateOfBirth",
                e.target.value
              )
            }
          />
          <label className="pre-visit-doc__label" htmlFor="previsit-patient-salutation">
            {t.patientGenderOrSalutationLabel}
          </label>
          <input
            id="previsit-patient-salutation"
            className="pre-visit-doc__input"
            type="text"
            value={patientIdentity.patientGenderOrSalutation}
            onChange={(e) =>
              handlePatientIdentityFieldChange(
                "patientGenderOrSalutation",
                e.target.value
              )
            }
          />
          <label className="pre-visit-doc__label" htmlFor="previsit-patient-phone">
            {t.patientPhoneLabel}
          </label>
          <input
            id="previsit-patient-phone"
            className="pre-visit-doc__input"
            type="tel"
            value={patientIdentity.patientPhone}
            onChange={(e) =>
              handlePatientIdentityFieldChange("patientPhone", e.target.value)
            }
            autoComplete="tel"
          />
        </div>

        {hasAuthToken ? (
          <div className="pre-visit-doc__field pre-visit-doc__field--timeline">
            <h2 className="pre-visit-doc__recipient-heading">{t.timelineSection}</h2>
            <p className="pre-visit-doc__field-hint">{t.timelineHint}</p>
            <label className="pre-visit-doc__label" htmlFor="previsit-case-topic">
              {t.timelineTopicLabel}
            </label>
            <input
              id="previsit-case-topic"
              className="pre-visit-doc__input"
              type="text"
              value={caseTimeline.caseTopic}
              onChange={(e) =>
                updateCaseTimeline({ caseTopic: e.target.value })
              }
              placeholder={t.timelineTopicPlaceholder}
            />
            <label
              className="pre-visit-doc__label"
              htmlFor="previsit-related-session"
            >
              {t.timelineSelectLabel}
            </label>
            <select
              id="previsit-related-session"
              className="pre-visit-doc__select"
              value={caseTimeline.relatedSessionId}
              onChange={(e) =>
                updateCaseTimeline({
                  relatedSessionId: e.target.value,
                  summary: null,
                })
              }
              disabled={timelineLoading}
            >
              <option value="">{t.timelineSelectNone}</option>
              {timelineSessions
                .filter((row) => row.id !== session?.id)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {new Date(row.createdAt).toLocaleDateString()} —{" "}
                    {String(row?.answers?.appointmentReason || "").trim() ||
                      t.timelineUntitled}
                  </option>
                ))}
            </select>
            <div className="pre-visit-doc__timeline-actions">
              <button
                type="button"
                className="pre-visit-doc__btn pre-visit-doc__btn--timeline"
                onClick={() => void handleGenerateTimelineSummary()}
                disabled={timelineBusy || !caseTimeline.relatedSessionId}
              >
                {timelineBusy ? t.timelineComparing : t.timelineCompare}
              </button>
            </div>
            {timelineError ? (
              <p className="pre-visit-doc__email-error" role="alert">
                {timelineError}
              </p>
            ) : null}
            {caseTimeline.summary ? (
              <div className="pre-visit-doc__timeline-summary">
                <p className="pre-visit-doc__timeline-title">{t.timelineResultTitle}</p>
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.timelineNewlyMentioned}: </strong>
                  {(caseTimeline.summary.newlyMentioned || []).join(" | ") || t.empty}
                </p>
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.timelineStillMentioned}: </strong>
                  {(caseTimeline.summary.stillMentioned || []).join(" | ") || t.empty}
                </p>
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.timelineNoLongerMentioned}: </strong>
                  {(caseTimeline.summary.noLongerMentioned || []).join(" | ") ||
                    t.empty}
                </p>
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.timelineUnclear}: </strong>
                  {(caseTimeline.summary.unclear || []).join(" | ") || t.empty}
                </p>
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.timelinePatientAddedNewInformation}: </strong>
                  {(caseTimeline.summary.patientAddedNewInformation || []).join(
                    " | ",
                  ) || t.empty}
                </p>
                <p className="pre-visit-doc__timeline-line">
                  <strong>{t.timelinePatientDidNotMentionPrior}: </strong>
                  {(
                    caseTimeline.summary
                      .patientDidNotMentionPreviouslyReportedInformation || []
                  ).join(" | ") || t.empty}
                </p>
                <label className="pre-visit-doc__checkbox-label">
                  <input
                    type="checkbox"
                    className="pre-visit-doc__checkbox"
                    checked={caseTimeline.includeInPdf}
                    onChange={(e) =>
                      updateCaseTimeline({ includeInPdf: e.target.checked })
                    }
                  />
                  <span className="pre-visit-doc__checkbox-text">
                    {t.timelineIncludePdf}
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {hasAuthToken && longitudinalUi?.caseId ? (
          <div className="pre-visit-doc__field pre-visit-doc__field--longitudinal-pdf">
            <h2 className="pre-visit-doc__recipient-heading">
              {t.longitudinalPdfSection}
            </h2>
            <p className="pre-visit-doc__field-hint">{t.longitudinalPdfNote}</p>
            <Link
              className="pre-visit-doc__manage-book-link"
              to={`/pre-visit/cases/${encodeURIComponent(longitudinalUi.caseId)}`}
            >
              {t.linkMyCases}
            </Link>
            <div className="pre-visit-doc__timeline-actions">
              <button
                type="button"
                className="pre-visit-doc__btn pre-visit-doc__btn--timeline"
                disabled={longitudinalOverviewBusy}
                onClick={() => void handleLoadSessionsOverview()}
              >
                {longitudinalOverviewBusy
                  ? t.longitudinalLoadOverviewBusy
                  : t.longitudinalLoadOverview}
              </button>
            </div>
            {longitudinalPdfErr ? (
              <p className="pre-visit-doc__email-error" role="alert">
                {longitudinalPdfErr}
              </p>
            ) : null}
            <label className="pre-visit-doc__checkbox-label">
              <input
                type="checkbox"
                className="pre-visit-doc__checkbox"
                checked={!!longitudinalUi.pdfInclude.caseTitle}
                onChange={(e) =>
                  patchLongitudinalPdfInclude({ caseTitle: e.target.checked })
                }
              />
              <span className="pre-visit-doc__checkbox-text">
                {t.longitudinalPdfCaseTitle}
              </span>
            </label>
            <label className="pre-visit-doc__checkbox-label">
              <input
                type="checkbox"
                className="pre-visit-doc__checkbox"
                checked={!!longitudinalUi.pdfInclude.continuitySummary}
                onChange={(e) =>
                  patchLongitudinalPdfInclude({
                    continuitySummary: e.target.checked,
                  })
                }
              />
              <span className="pre-visit-doc__checkbox-text">
                {t.longitudinalPdfContinuity}
              </span>
            </label>
            <label className="pre-visit-doc__checkbox-label">
              <input
                type="checkbox"
                className="pre-visit-doc__checkbox"
                checked={!!longitudinalUi.pdfInclude.sessionsOverview}
                onChange={(e) =>
                  patchLongitudinalPdfInclude({
                    sessionsOverview: e.target.checked,
                  })
                }
              />
              <span className="pre-visit-doc__checkbox-text">
                {t.longitudinalPdfSessionsOverview}
              </span>
            </label>
            <label className="pre-visit-doc__checkbox-label">
              <input
                type="checkbox"
                className="pre-visit-doc__checkbox"
                checked={!!longitudinalUi.pdfInclude.relatedReportsSummary}
                onChange={(e) =>
                  patchLongitudinalPdfInclude({
                    relatedReportsSummary: e.target.checked,
                  })
                }
              />
              <span className="pre-visit-doc__checkbox-text">
                {t.longitudinalPdfRelatedReports}
              </span>
            </label>
            {!caseTimeline.summary ? (
              <p className="pre-visit-doc__field-hint" role="note">
                {t.longitudinalPdfCompareHint}
              </p>
            ) : null}
          </div>
        ) : null}

        {hasAuthToken ? (
          <div className="pre-visit-doc__field pre-visit-doc__field--recipient">
            <h2 className="pre-visit-doc__recipient-heading">
              {t.doctorRecipientSection}
            </h2>
            <p className="pre-visit-doc__field-hint">{t.doctorRecipientHint}</p>
            <label className="pre-visit-doc__label" htmlFor="previsit-doctor-recipient">
              {t.doctorRecipientFieldLabel}
            </label>
            <select
              id="previsit-doctor-recipient"
              className="pre-visit-doc__select"
              value={selectedDoctorRecipientValue}
              onChange={handleDoctorRecipientChange}
              disabled={doctorContactsLoading}
              aria-busy={doctorContactsLoading}
            >
              <option value="">{t.doctorRecipientNone}</option>
              {doctorContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.doctorName, c.practiceName].filter(Boolean).join(" — ") ||
                    c.email}
                </option>
              ))}
            </select>
            {doctorContactsLoading ? (
              <p className="pre-visit-doc__recipient-meta" role="status">
                {t.doctorRecipientLoading}
              </p>
            ) : null}
            {selectedContactForRecipient &&
            !String(selectedContactForRecipient.email || "").trim() ? (
              <p className="pre-visit-doc__ai-error" role="alert">
                {t.doctorRecipientEmailMissing}
              </p>
            ) : null}
            <Link
              className="pre-visit-doc__manage-book-link"
              to="/settings/doctor-contacts"
            >
              {t.doctorRecipientManage}
            </Link>
          </div>
        ) : null}

        <div className="pre-visit-doc__preview">
          <section
            className="pre-visit-doc__section-block"
            aria-labelledby="previsit-structured-heading"
          >
            <h2
              id="previsit-structured-heading"
              className="pre-visit-doc__section-heading"
            >
              {t.sectionStructured}
            </h2>
            <div className="pre-visit-doc__rows">
              {STRUCTURED_SECTION_ORDER.map((key) => {
                const text = structuredSource[key] ?? "";
                const empty = !String(text).trim();
                return (
                  <div key={key} className="pre-visit-doc__row">
                    <p className="pre-visit-doc__row-label">
                      {structuredHeading(key)}
                    </p>
                    <p
                      className={`pre-visit-doc__row-value ${
                        empty ? "pre-visit-doc__row-value--empty" : ""
                      }`}
                    >
                      {empty ? t.empty : text}
                    </p>
                  </div>
                );
              })}
            </div>
            {aiFresh && session.aiSafetyNotice?.trim() ? (
              <p className="pre-visit-doc__ai-safety-inline" role="note">
                {session.aiSafetyNotice.trim()}
              </p>
            ) : null}
          </section>

          <section
            className="pre-visit-doc__section-block"
            aria-labelledby="previsit-original-heading"
          >
            <h2
              id="previsit-original-heading"
              className="pre-visit-doc__section-heading"
            >
              {t.sectionOriginal}
            </h2>
            <div className="pre-visit-doc__rows">
              {PRE_VISIT_QUESTION_STEPS.map((step) => {
                const text = session.answers[step.key] ?? "";
                const empty = !String(text).trim();
                const titleOriginal = pickLocalized(step.title, patientLang);
                return (
                  <div key={step.key} className="pre-visit-doc__row">
                    <p className="pre-visit-doc__row-label">{titleOriginal}</p>
                    <p
                      className={`pre-visit-doc__row-value ${
                        empty ? "pre-visit-doc__row-value--empty" : ""
                      }`}
                    >
                      {empty ? t.empty : text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="pre-visit-doc__block-note">{t.disclaimer}</p>
        </div>

        <nav
          className="pre-visit-doc__main-actions"
          aria-label={t.mainNavAria}
        >
          <div className="pre-visit-doc__ai-block">
            <button
              type="button"
              className="pre-visit-doc__btn pre-visit-doc__btn--create-ai"
              onClick={handleCreateDoctorVersion}
              disabled={aiLoading}
              aria-busy={aiLoading}
            >
              {t.createDoctorVersion}
            </button>
            {aiLoading ? (
              <p
                className="pre-visit-doc__ai-loading"
                aria-live="polite"
                role="status"
              >
                {t.creatingDoctorVersion}
              </p>
            ) : null}
            {aiError ? (
              <p className="pre-visit-doc__ai-error" role="alert">
                {aiError}
              </p>
            ) : null}
            {aiSuccessNote ? (
              <p
                className="pre-visit-doc__ai-success-note"
                role="status"
                aria-live="polite"
              >
                {aiSuccessNote}
              </p>
            ) : null}
          </div>
          <div className="pre-visit-doc__pdf-lead">
            <div className="pre-visit-doc__pdf-actions">
              <button
                type="button"
                className="pre-visit-doc__btn pre-visit-doc__btn--pdf-primary"
                onClick={handleDownloadPdf}
                aria-describedby="previsit-pdf-local-note"
              >
                {t.pdfDisabled}
              </button>
              <button
                type="button"
                className="pre-visit-doc__btn pre-visit-doc__btn--qr-secondary"
                onClick={() => void handleOpenQrShare()}
                disabled={qrBusy}
                aria-busy={qrBusy}
              >
                {t.qrShareButton}
              </button>
            </div>
            <p id="previsit-pdf-local-note" className="pre-visit-doc__pdf-hint">
              {t.pdfLocalNote}
            </p>
            {qrError ? (
              <p className="pre-visit-doc__qr-inline-error" role="alert">
                {qrError}
              </p>
            ) : null}
          </div>

          {qrModalOpen ? (
            <div
              className="pre-visit-doc__qr-backdrop"
              role="presentation"
              onClick={() => setQrModalOpen(false)}
            >
              <div
                className="pre-visit-doc__qr-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="previsit-qr-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="previsit-qr-title"
                  className="pre-visit-doc__qr-title"
                >
                  {t.qrShareTitle}
                </h2>
                <p className="pre-visit-doc__qr-intro">{t.qrShareIntro}</p>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt=""
                    className="pre-visit-doc__qr-img"
                    width={280}
                    height={280}
                  />
                ) : null}
                <button
                  type="button"
                  className="pre-visit-doc__btn pre-visit-doc__btn--pdf-primary"
                  onClick={() => setQrModalOpen(false)}
                >
                  {t.qrShareClose}
                </button>
              </div>
            </div>
          ) : null}

          {hasAuthToken ? (
            <div className="pre-visit-doc__email-block">
              <h2 className="pre-visit-doc__email-heading">{t.emailPdfSection}</h2>
              <p className="pre-visit-doc__email-privacy">{t.emailPdfPrivacy}</p>
              <label className="pre-visit-doc__checkbox-label">
                <input
                  type="checkbox"
                  className="pre-visit-doc__checkbox"
                  checked={consentEmailPdf}
                  onChange={(e) => {
                    setConsentEmailPdf(e.target.checked);
                    setEmailPdfError(null);
                    setEmailPdfSuccess(false);
                  }}
                  disabled={emailPdfSending}
                />
                <span className="pre-visit-doc__checkbox-text">
                  {t.emailPdfConsent}
                </span>
              </label>
              <button
                type="button"
                className="pre-visit-doc__btn pre-visit-doc__btn--email-send"
                onClick={() => void handleSendPdfEmail()}
                disabled={
                  emailPdfSending ||
                  !consentEmailPdf ||
                  !selectedDoctorRecipientValue ||
                  !String(selectedContactForRecipient?.email || "").trim()
                }
                aria-busy={emailPdfSending}
              >
                {emailPdfSending ? t.emailPdfSending : t.emailPdfSend}
              </button>
              {emailPdfSuccess ? (
                <p className="pre-visit-doc__email-success" role="status">
                  {t.emailPdfSuccess}
                </p>
              ) : null}
              {emailPdfError ? (
                <p className="pre-visit-doc__email-error" role="alert">
                  {emailPdfError}
                </p>
              ) : null}
            </div>
          ) : null}

          <Link className="pre-visit-doc__back-review" to="/pre-visit/review">
            {t.backReview}
          </Link>
        </nav>

        <section
          className="pre-visit-doc__consent pre-visit-doc__consent--account"
          aria-labelledby="previsit-account-heading"
        >
          <h2
            id="previsit-account-heading"
            className="pre-visit-doc__consent-title pre-visit-doc__consent-title--account"
          >
            {t.accountSectionTitle}
          </h2>

          {!hasAuthToken ? (
            <div className="pre-visit-doc__account-login">
              <p className="pre-visit-doc__account-login-hint">{t.accountLoginHint}</p>
              <Link
                className="pre-visit-doc__btn pre-visit-doc__btn--account-login"
                to="/login"
              >
                {t.accountLoginLink}
              </Link>
            </div>
          ) : (
            <>
              <label className="pre-visit-doc__checkbox-label">
                <input
                  type="checkbox"
                  className="pre-visit-doc__checkbox"
                  checked={consentAccountSave}
                  onChange={(e) => {
                    setConsentAccountSave(e.target.checked);
                    setAccountSaveSuccess(false);
                    setAccountSaveError(null);
                  }}
                />
                <span className="pre-visit-doc__checkbox-text">
                  {t.accountConsentCheckbox}
                </span>
              </label>

              <p className="pre-visit-doc__consent-expl">{t.accountConsentExpl}</p>

              <button
                type="button"
                className="pre-visit-doc__btn pre-visit-doc__btn--account"
                disabled={!consentAccountSave || accountSaving}
                aria-busy={accountSaving}
                onClick={handleSaveToAccount}
              >
                {t.saveToAccount}
              </button>

              {accountSaveSuccess ? (
                <p
                  className="pre-visit-doc__save-success"
                  role="status"
                  aria-live="polite"
                >
                  {t.accountSaveSuccess}
                </p>
              ) : null}

              {accountSaveError ? (
                <p className="pre-visit-doc__account-error" role="alert">
                  {accountSaveError}
                </p>
              ) : null}

              <Link
                className="pre-visit-doc__account-history-link"
                to="/pre-visit/my-preparations"
              >
                {t.viewMyPreparations}
              </Link>
              <Link className="pre-visit-doc__manage-book-link" to="/pre-visit/cases">
                {t.linkMyCases}
              </Link>
            </>
          )}
        </section>

        <section
          className="pre-visit-doc__consent pre-visit-doc__consent--secondary"
          aria-labelledby="previsit-consent-heading"
        >
          <h2 id="previsit-consent-heading" className="pre-visit-doc__consent-title">
            {t.consentSectionTitle}
          </h2>

          <label className="pre-visit-doc__checkbox-label">
            <input
              type="checkbox"
              className="pre-visit-doc__checkbox"
              checked={consentLocalSave}
              onChange={(e) => {
                setConsentLocalSave(e.target.checked);
                setSaveSuccess(false);
              }}
            />
            <span className="pre-visit-doc__checkbox-text">{t.consentCheckbox}</span>
          </label>

          <p className="pre-visit-doc__consent-expl">{t.consentExpl}</p>

          <button
            type="button"
            className="pre-visit-doc__btn pre-visit-doc__btn--archive"
            disabled={!consentLocalSave}
            onClick={handleSaveArchive}
          >
            {t.saveLocal}
          </button>

          {saveSuccess ? (
            <p className="pre-visit-doc__save-success" role="status" aria-live="polite">
              {t.saveSuccess}
            </p>
          ) : null}

          <p className="pre-visit-doc__archive-note">{t.archiveNote}</p>
          <Link className="pre-visit-doc__history-link" to="/pre-visit/history">
            {t.historyLink}
          </Link>
        </section>
      </div>
    </div>
  );
}
