import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";

function statusLabel(t, st) {
  switch (st) {
    case "draft":
      return t.statusDraft;
    case "created":
      return t.statusCreated;
    case "shared_link":
      return t.statusSharedLink;
    case "revoked":
      return t.statusRevoked;
    case "expired":
      return t.statusExpired;
    default:
      return st || "—";
  }
}

export default function AccountDocumentsPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await authFetch("/api/account/patient-documents");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("fail");
      setItems(Array.isArray(j.documents) ? j.documents : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
      setItems([]);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = `${t.documentsTitle} — MedScoutX`;
  }, [t.documentsTitle]);

  return (
    <div className="account-portal-page">
      <h1 className="account-portal-page__title">{t.documentsTitle}</h1>
      <p className="account-portal-page__lead">{t.documentsIntro}</p>
      {error ? <p className="account-portal__error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="account-portal-card__empty">{t.docNone}</p>
      ) : (
        <ul className="account-portal-doc-list">
          {items.map((row) => (
            <li key={row.id} className="account-portal-doc-list__item">
              <div className="account-portal-doc-list__main">
                <span className="account-portal-doc-list__title">
                  {row.kind === "secure_link" ? row.sessionTitle || "Secure link" : row.title}
                </span>
                <span className="account-portal-doc-list__meta">
                  {row.practiceName ? `${row.practiceName} · ` : ""}
                  {statusLabel(t, row.status)}
                </span>
              </div>
              <div className="account-portal-doc-list__actions">
                {row.sessionId ? (
                  <Link className="account-portal__btn account-portal__btn--small" to="/pre-visit/my-preparations">
                    {t.downloadPrep}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
