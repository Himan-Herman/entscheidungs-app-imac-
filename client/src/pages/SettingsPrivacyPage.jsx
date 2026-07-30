import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations/index.js";
import { authFetch } from "../api/authFetch.js";
import PreVisitModuleChrome from "../features/preVisit/components/PreVisitModuleChrome.jsx";
import AccountDeletionDialog from "../features/lifecycleExit/components/AccountDeletionDialog.jsx";
import "../styles/SettingsPrivacyPage.css";
import "../styles/LifecycleExit.css";

const SUPPORT_EMAIL = "contact@medscoutx.com";

export default function SettingsPrivacyPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const bundle = getMessages(language);
    return bundle.settingsPrivacy ?? getMessages("en").settingsPrivacy;
  }, [language]);
  const tExit = useMemo(() => {
    const bundle = getMessages(language);
    return bundle.lifecycleExit?.patient ?? getMessages("en").lifecycleExit.patient;
  }, [language]);

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [exportErr, setExportErr] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletedCase, setDeletedCase] = useState(null);
  // Set when the SERVER refuses because this account owns a practice. There is
  // deliberately no client-side ownership probe: the release gate in
  // routes/account.js is the single source of truth, and asking
  // GET /api/practices would be worse than redundant — that endpoint creates a
  // demo practice as a side effect, which would turn every visitor of this
  // page into a practice owner and lock them out of deletion for good.
  const [ownerBlocked, setOwnerBlocked] = useState(false);

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

  function handleDeleted({ caseNumber }) {
    setDialogOpen(false);
    setDeletedCase(caseNumber ?? "—");
    // The account is gone: drop the now-invalid local session.
    localStorage.removeItem("medscout_token");
    localStorage.removeItem("medscout_user_id");
  }

  // Post-deletion confirmation view: the rest of the page would only trigger
  // 401s, so it is replaced entirely.
  if (deletedCase !== null) {
    return (
      <div className="settings-privacy">
        <div className="settings-privacy__inner">
          <section className="settings-privacy__card" aria-labelledby="privacy-deleted-title">
            <h1 id="privacy-deleted-title" className="settings-privacy__title">
              {tExit.successTitle}
            </h1>
            <p className="settings-privacy__muted" role="status">
              {tExit.successBody.replace("{caseNumber}", deletedCase)}
            </p>
            <p className="lifecycle-exit__note">{tExit.successEmailHint}</p>
            <p className="lifecycle-exit__support">
              {tExit.supportLabel}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
            <Link className="lifecycle-exit__btn lifecycle-exit__btn--primary" to="/">
              MedScoutX
            </Link>
          </section>
        </div>
      </div>
    );
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

        <section className="settings-privacy__card" aria-labelledby="privacy-legal-links-title">
          <h2 id="privacy-legal-links-title" className="settings-privacy__section-title">
            {t.legalLinksTitle}
          </h2>
          <p className="settings-privacy__muted">{t.legalLinksIntro}</p>
          <nav className="settings-privacy__legal-nav" aria-label={t.legalLinksTitle}>
            <Link className="settings-privacy__legal-link" to="/datenschutz">
              {t.linkPrivacy}
            </Link>
            <Link className="settings-privacy__legal-link" to="/impressum">
              {t.linkImprint}
            </Link>
            <Link className="settings-privacy__legal-link" to="/agb">
              {t.linkTerms}
            </Link>
            <Link className="settings-privacy__legal-link" to="/account/data">
              {t.linkAccountPrivacyHub}
            </Link>
          </nav>
        </section>

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
            {tExit.dangerTitle}
          </h2>
          <p className="settings-privacy__muted">{tExit.dangerIntro}</p>

          <h3 className="lifecycle-exit__label">{tExit.whatDeletedTitle}</h3>
          <ul className="lifecycle-exit__list">
            {tExit.whatDeletedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="lifecycle-exit__label">{tExit.whatRemainsTitle}</h3>
          <ul className="lifecycle-exit__list">
            {tExit.whatRemainsItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="lifecycle-exit__note">{tExit.whatRemainsNote}</p>
          <p className="lifecycle-exit__note">{tExit.exportHint}</p>
          <p className="lifecycle-exit__note">{tExit.receiptHint}</p>

          {ownerBlocked ? (
            <div className="lifecycle-exit__warning-card" role="alert">
              <p className="lifecycle-exit__warning-title">
                <span aria-hidden="true">⚠️</span> {tExit.ownerNoticeTitle}
              </p>
              <p className="lifecycle-exit__note">{tExit.ownerNotice}</p>
              <Link
                className="lifecycle-exit__btn lifecycle-exit__btn--primary"
                to="/practice/settings"
              >
                {tExit.ownerManageButton}
              </Link>
            </div>
          ) : null}

          <button
            type="button"
            className="lifecycle-exit__btn lifecycle-exit__btn--outline-danger"
            onClick={() => setDialogOpen(true)}
          >
            {tExit.openDialogButton}
          </button>

          <p className="lifecycle-exit__support">
            {tExit.supportLabel}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </section>

        <AccountDeletionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onDeleted={handleDeleted}
          onOwnerBlocked={() => {
            setDialogOpen(false);
            setOwnerBlocked(true);
          }}
          t={tExit}
        />
      </div>
    </div>
  );
}
