import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";

const DELETE_PREVISIT = "DELETE_MY_PREVISIT_DATA";

export default function AccountDataPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function exportJson() {
    setMsg("");
    try {
      const res = await authFetch("/api/account/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medscoutx-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(t.confirmExport);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setMsg(t.loadError);
    }
  }

  async function deletePrevisit() {
    if (phrase.trim() !== DELETE_PREVISIT) return;
    if (!window.confirm(language === "de" ? "Wirklich alle Pre-Visit-Daten löschen?" : "Delete all Pre-Visit data?")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await authFetch("/api/account/delete-previsit-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: DELETE_PREVISIT }),
      });
      if (!res.ok) throw new Error();
      setMsg(language === "de" ? "Pre-Visit-Daten wurden gelöscht." : "Pre-Visit data deleted.");
      setPhrase("");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setMsg(t.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-portal-page">
      <h1 className="account-portal-page__title">{t.dataTitle}</h1>
      <p className="account-portal-page__lead">{t.dataIntro}</p>

      <section className="account-portal-danger">
        <h2 className="account-portal-danger__title">{t.exportJson}</h2>
        <button type="button" className="account-portal__btn account-portal__btn--primary" onClick={() => void exportJson()}>
          {t.exportJson}
        </button>
      </section>

      <section className="account-portal-danger account-portal-danger--red">
        <h2 className="account-portal-danger__title">{t.deletePrevisitLabel}</h2>
        <p>{t.deletePrevisitHint}</p>
        <input
          className="account-portal-form__input"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={t.deletePrevisitPlaceholder}
          autoComplete="off"
        />
        <button type="button" className="account-portal__btn" disabled={busy || phrase.trim() !== DELETE_PREVISIT} onClick={() => void deletePrevisit()}>
          {t.deletePrevisitButton}
        </button>
      </section>

      <section className="account-portal-danger">
        <h2 className="account-portal-danger__title">{t.deleteAccountLabel}</h2>
        <p>{t.deleteAccountHint}</p>
        <p>
          <Link to="/settings/privacy">{t.goPrivacy}</Link>
        </p>
      </section>

      {msg ? <p className="account-portal__ok">{msg}</p> : null}
    </div>
  );
}
