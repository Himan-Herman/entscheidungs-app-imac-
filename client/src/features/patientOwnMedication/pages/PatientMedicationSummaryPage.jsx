import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { listOwnMedications } from "../patientOwnMedicationStore.js";
import {
  buildOwnMedicationPdfBlob,
  downloadOwnMedicationPdf,
  getOwnMedicationPdfFilename,
} from "../pdf/generateOwnMedicationPdf.js";
import { buildSharePayload, buildShareUrl } from "../shareCodec.js";
import {
  fetchDoctorContacts,
  sendMedicationPdfToContact,
} from "../api/doctorContactsApi.js";
import OwnMedicationQrModal from "../components/OwnMedicationQrModal.jsx";
import "../styles/PatientMedicationSummary.css";

const NAME_STORAGE_KEY = "medscoutx_med_summary_name_v1";

function readStoredName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function fmtDateTime(iso, lang) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function fmtPeriod(entry, lang, ongoingLabel) {
  const opts = { day: "2-digit", month: "2-digit", year: "numeric" };
  const loc = getPrimaryIntlLocale(lang);
  const start = entry.startDate
    ? new Date(entry.startDate).toLocaleDateString(loc, opts)
    : "";
  const end = entry.endDate
    ? new Date(entry.endDate).toLocaleDateString(loc, opts)
    : "";
  if (!start && !end) return "";
  return `${start || "…"} – ${end || ongoingLabel}`;
}

export default function PatientMedicationSummaryPage() {
  const { language } = useLanguage();
  const base = useMemo(
    () =>
      getMessages(language).patientMedicationPlan ||
      getMessages("en").patientMedicationPlan,
    [language],
  );
  const t = useMemo(() => base.summary || {}, [base]);
  // Merge field labels used by the PDF/text builders.
  const pdfLabels = useMemo(
    () => ({
      ...t,
      fieldDosage: base.fieldDosage,
      fieldSchedule: base.fieldSchedule,
      fieldInstructions: base.fieldInstructions,
      planTitleFallback: base.planTitleFallback,
    }),
    [t, base],
  );

  const [entries, setEntries] = useState(() => listOwnMedications());
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [patientName, setPatientName] = useState(readStoredName);
  const [qrOpen, setQrOpen] = useState(false);

  // Doctor-book send state
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [sendConsent, setSendConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState({ type: "", text: "" });

  const refresh = useCallback(() => {
    setEntries(listOwnMedications());
    setGeneratedAt(new Date());
  }, []);

  // Keep the preview in sync: re-read whenever the tab regains focus, so meds
  // added elsewhere show up automatically without a manual refresh.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    document.title = t.pageTitle || base.pageTitle || "Medication summary";
  }, [t.pageTitle, base.pageTitle]);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const { res, data } = await fetchDoctorContacts();
      if (!res.ok || !data.ok) {
        setContacts([]);
        return;
      }
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleNameChange = (value) => {
    setPatientName(value);
    try {
      localStorage.setItem(NAME_STORAGE_KEY, value);
    } catch {
      /* ignore quota / private mode */
    }
  };

  const shareUrl = useMemo(
    () =>
      buildShareUrl(
        buildSharePayload({
          entries,
          patientName: patientName.trim(),
          generatedAt,
          lang: language,
        }),
      ),
    [entries, patientName, generatedAt, language],
  );

  const handleDownloadPdf = () => {
    downloadOwnMedicationPdf({
      entries,
      t: pdfLabels,
      patientName: patientName.trim(),
      generatedAt,
      lang: language,
    });
  };

  const handleSend = async () => {
    setSendMsg({ type: "", text: "" });
    if (!selectedContactId) {
      setSendMsg({ type: "error", text: t.sendSelectRequired });
      return;
    }
    const contact = contacts.find((c) => c.id === selectedContactId);
    if (!contact?.email) {
      setSendMsg({ type: "error", text: t.sendNoEmail });
      return;
    }
    if (!sendConsent) {
      setSendMsg({ type: "error", text: t.sendConsentRequired });
      return;
    }
    const blob = buildOwnMedicationPdfBlob({
      entries,
      t: pdfLabels,
      patientName: patientName.trim(),
      generatedAt,
      lang: language,
    });
    if (!blob) {
      setSendMsg({ type: "error", text: t.sendErrorGeneric });
      return;
    }
    setSending(true);
    try {
      const { res, data } = await sendMedicationPdfToContact(
        selectedContactId,
        blob,
        getOwnMedicationPdfFilename(language),
        language,
      );
      if (!res.ok || !data.ok) {
        const msg =
          typeof data?.message === "string" && data.message.trim()
            ? data.message
            : t.sendErrorGeneric;
        setSendMsg({ type: "error", text: msg });
        return;
      }
      setSendMsg({ type: "success", text: t.sendSuccess });
      setSendConsent(false);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setSendMsg({ type: "error", text: t.sendErrorGeneric });
    } finally {
      setSending(false);
    }
  };

  const hasEntries = entries.length > 0;
  const loc = getPrimaryIntlLocale(language);
  const generatedLabel = (t.generatedAt || "Summarized on {date}").replace(
    "{date}",
    generatedAt.toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" }),
  );
  const countLabel = (t.countLabel || "{count} medication(s)").replace(
    "{count}",
    String(entries.length),
  );

  return (
    <div className="pmed-summary">
      <Link className="pmed-summary__back" to="/patient/medication-plans">
        ← {t.back || base.backList}
      </Link>

      <header className="pmed-summary__header">
        <h1 className="pmed-summary__title">{t.heading || "Medication summary"}</h1>
        <p className="pmed-summary__intro">{t.intro}</p>
        <p className="pmed-summary__safety">{t.safetyNote || base.safetyNote}</p>
      </header>

      {!hasEntries ? (
        <div className="pmed-summary__empty">
          <p className="pmed-summary__empty-title">{t.emptyTitle}</p>
          <p className="pmed-summary__empty-text">{t.emptyText}</p>
          <Link className="pmed-btn pmed-btn--primary" to="/patient/medication-plans">
            {t.emptyCta || base.addMedication}
          </Link>
        </div>
      ) : (
        <>
          <section className="pmed-summary__controls" aria-label={t.heading}>
            <div className="pmed-summary__name-field">
              <label className="pmed-summary__label" htmlFor="pmed-name">
                {t.nameLabel}
              </label>
              <input
                id="pmed-name"
                className="pmed-summary__input"
                type="text"
                value={patientName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t.namePlaceholder}
                autoComplete="name"
                maxLength={120}
              />
            </div>
            <button
              type="button"
              className="pmed-btn pmed-btn--secondary"
              onClick={refresh}
            >
              ↻ {t.refresh}
            </button>
          </section>

          <section className="pmed-preview" aria-label={t.previewTitle}>
            <div className="pmed-preview__doc">
              <div className="pmed-preview__brand">MedScoutX</div>
              <h2 className="pmed-preview__doc-title">{t.documentTitle}</h2>
              <p className="pmed-preview__meta">
                {patientName.trim() ? (
                  <span className="pmed-preview__meta-name">
                    {patientName.trim()}
                  </span>
                ) : null}
                <span>{generatedLabel}</span>
                <span>{countLabel}</span>
              </p>

              <ul className="pmed-preview__list">
                {entries.map((entry, idx) => {
                  const period = fmtPeriod(entry, language, t.ongoing || "ongoing");
                  return (
                    <li className="pmed-preview__item" key={entry.id}>
                      <div className="pmed-preview__item-name">
                        <span className="pmed-preview__item-index">{idx + 1}</span>
                        {entry.name || base.planTitleFallback}
                      </div>
                      {entry.createdAt ? (
                        <div className="pmed-preview__item-added">
                          {t.addedLabel} · {fmtDateTime(entry.createdAt, language)}
                        </div>
                      ) : null}
                      <dl className="pmed-preview__grid">
                        {entry.dosage ? (
                          <>
                            <dt>{base.fieldDosage}</dt>
                            <dd>{entry.dosage}</dd>
                          </>
                        ) : null}
                        {entry.schedule ? (
                          <>
                            <dt>{base.fieldSchedule}</dt>
                            <dd>{entry.schedule}</dd>
                          </>
                        ) : null}
                        {period ? (
                          <>
                            <dt>{t.periodLabel}</dt>
                            <dd>{period}</dd>
                          </>
                        ) : null}
                        {entry.instructions ? (
                          <>
                            <dt>{base.fieldInstructions}</dt>
                            <dd>{entry.instructions}</dd>
                          </>
                        ) : null}
                      </dl>
                    </li>
                  );
                })}
              </ul>

              <p className="pmed-preview__disclaimer">{t.disclaimer}</p>
            </div>
          </section>

          <section className="pmed-summary__export" aria-label={t.exportTitle}>
            <button
              type="button"
              className="pmed-btn pmed-btn--primary"
              onClick={handleDownloadPdf}
            >
              ⤓ {t.downloadPdf}
            </button>
            <button
              type="button"
              className="pmed-btn pmed-btn--secondary"
              onClick={() => setQrOpen(true)}
            >
              ▦ {t.qrOpen}
            </button>
          </section>

          <section className="pmed-send" aria-labelledby="pmed-send-title">
            <h2 id="pmed-send-title" className="pmed-send__title">
              {t.sendTitle}
            </h2>
            <p className="pmed-send__intro">{t.sendIntro}</p>

            {contactsLoading ? (
              <p className="pmed-summary__muted">{base.loading}</p>
            ) : contacts.length === 0 ? (
              <div className="pmed-send__empty">
                <p className="pmed-summary__muted">{t.sendNoContacts}</p>
                <Link className="pmed-link" to="/settings/doctor-contacts">
                  {t.sendManageContacts} →
                </Link>
              </div>
            ) : (
              <>
                <div className="pmed-send__field">
                  <label className="pmed-summary__label" htmlFor="pmed-contact">
                    {t.sendSelectLabel}
                  </label>
                  <select
                    id="pmed-contact"
                    className="pmed-summary__input"
                    value={selectedContactId}
                    onChange={(e) => {
                      setSelectedContactId(e.target.value);
                      setSendMsg({ type: "", text: "" });
                    }}
                  >
                    <option value="">{t.sendSelectPlaceholder}</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.doctorName}
                        {c.specialty ? ` — ${c.specialty}` : ""}
                        {c.email ? ` (${c.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="pmed-send__consent">
                  <input
                    type="checkbox"
                    checked={sendConsent}
                    onChange={(e) => setSendConsent(e.target.checked)}
                  />
                  <span>{t.sendConsentLabel}</span>
                </label>

                <button
                  type="button"
                  className="pmed-btn pmed-btn--primary"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? t.sendBusy : t.sendButton}
                </button>

                <Link className="pmed-link pmed-send__manage" to="/settings/doctor-contacts">
                  {t.sendManageContacts} →
                </Link>
              </>
            )}

            {sendMsg.text ? (
              <p
                className={
                  sendMsg.type === "success"
                    ? "pmed-send__ok"
                    : "pmed-send__error"
                }
                role={sendMsg.type === "success" ? "status" : "alert"}
              >
                {sendMsg.text}
              </p>
            ) : null}
          </section>
        </>
      )}

      {qrOpen ? (
        <OwnMedicationQrModal
          url={shareUrl}
          t={t}
          onClose={() => setQrOpen(false)}
        />
      ) : null}
    </div>
  );
}
