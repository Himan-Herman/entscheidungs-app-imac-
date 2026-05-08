import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations/index.js";
import { authFetch } from "../api/authFetch.js";
import PreVisitModuleChrome from "../features/preVisit/components/PreVisitModuleChrome.jsx";
import "../styles/SettingsPrivacyPage.css";

const CONFIRM_PHRASE = "DELETE_MY_MEDSCOUTX_DATA";

export default function SettingsPrivacyPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const bundle = getMessages(language);
    return bundle.settingsPrivacy ?? getMessages("en").settingsPrivacy;
  }, [language]);

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [exportErr, setExportErr] = useState("");

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteOk, setDeleteOk] = useState(false);

  async function handleExport() {
    setExportMsg("");
    setExportErr("");
    setExporting(true);
    try {
      const res = await authFetch("/api/account/export");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "export_failed");
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medscoutx-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(t.exportDone);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setExportErr(t.exportError);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteErr("");
    setDeleteOk(false);
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      setDeleteErr(t.deleteConfirmError);
      return;
    }
    setDeleting(true);
    try {
      const res = await authFetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: CONFIRM_PHRASE }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "delete_failed");
      }
      setDeleteOk(true);
      setConfirmText("");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setDeleteErr(t.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="settings-privacy">
      <div className="settings-privacy__inner">
        <PreVisitModuleChrome />
        <header className="settings-privacy__header">
          <h1 className="settings-privacy__title">{t.heading}</h1>
          <p className="settings-privacy__intro">{t.intro}</p>
          <Link className="settings-privacy__back" to="/startseite">
            {t.backStart}
          </Link>
        </header>

        <section className="settings-privacy__card" aria-labelledby="privacy-export-title">
          <h2 id="privacy-export-title" className="settings-privacy__section-title">
            {t.exportTitle}
          </h2>
          <p className="settings-privacy__muted">{t.exportHelp}</p>
          <button
            type="button"
            className="settings-privacy__btn settings-privacy__btn--primary"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? t.exporting : t.exportButton}
          </button>
          {exportMsg ? (
            <p className="settings-privacy__ok" role="status">
              {exportMsg}
            </p>
          ) : null}
          {exportErr ? (
            <p className="settings-privacy__err" role="alert">
              {exportErr}
            </p>
          ) : null}
        </section>

        <section
          className="settings-privacy__card settings-privacy__card--danger"
          aria-labelledby="privacy-delete-title"
        >
          <h2 id="privacy-delete-title" className="settings-privacy__section-title">
            {t.dangerTitle}
          </h2>
          <p className="settings-privacy__muted">{t.dangerHelp}</p>
          <p className="settings-privacy__phrase-hint">
            <strong>{t.dangerPhraseHint}</strong> <code>{CONFIRM_PHRASE}</code>
          </p>
          <form className="settings-privacy__danger-form" onSubmit={handleDelete}>
            <label className="settings-privacy__label" htmlFor="privacy-delete-confirm">
              {t.dangerPhraseLabel}
            </label>
            <input
              id="privacy-delete-confirm"
              className="settings-privacy__input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={t.dangerPlaceholder}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <button
              type="submit"
              className="settings-privacy__btn settings-privacy__btn--danger"
              disabled={deleting}
            >
              {deleting ? t.deleting : t.deleteButton}
            </button>
          </form>
          {deleteOk ? (
            <p className="settings-privacy__ok" role="status">
              {t.deleteSuccess}
            </p>
          ) : null}
          {deleteErr ? (
            <p className="settings-privacy__err" role="alert">
              {deleteErr}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
