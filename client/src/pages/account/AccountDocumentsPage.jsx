import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";
import { formatUiDate } from "../../i18n/intlLocale.js";

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

function kindLabel(t, kind) {
  if (kind === "secure_link") return t.kindSecureLink;
  return t.kindPreparation;
}

function rowTitle(t, row) {
  if (row.kind === "secure_link") {
    return row.sessionTitle?.trim() || t.secureLinkFallback;
  }
  return row.title?.trim() || t.defaultPrepTitle;
}

export default function AccountDocumentsPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
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
      <Link className="account-portal-page__back" to="/patient">
        {t.backPatientHub}
      </Link>

      <h1 className="account-portal-page__title">{t.documentsTitle}</h1>
      <p className="account-portal-page__lead">{t.documentsIntro}</p>
      <p className="account-portal-page__notice">
        {t.documentsPracticeHint}{" "}
        <Link className="account-portal-page__inline-link" to="/patient/practice-documents">
          {t.linkPracticeDocuments}
        </Link>
      </p>

      {error ? (
        <div className="account-portal__error-wrap" role="alert">
          <p className="account-portal__error">{error}</p>
          <button
            type="button"
            className="account-portal__btn"
            onClick={() => void load()}
          >
            {t.retryLoad}
          </button>
        </div>
      ) : null}

      <section aria-label={t.documentsTitle}>
        {loading ? (
          <p className="account-portal-card__empty">{t.loading}</p>
        ) : items.length === 0 && !error ? (
          <p className="account-portal-card__empty">{t.docNone}</p>
        ) : (
          <ul className="account-portal-doc-list">
            {items.map((row) => {
              const title = rowTitle(t, row);
              const dateIso = row.createdAt ?? row.updatedAt;
              const metaParts = [
                kindLabel(t, row.kind),
                row.practiceName || null,
                statusLabel(t, row.status),
                dateIso ? formatUiDate(dateIso, language) : null,
              ].filter(Boolean);

              return (
                <li key={row.id} className="account-portal-doc-list__item">
                  <div className="account-portal-doc-list__main">
                    <span className="account-portal-doc-list__title">{title}</span>
                    <span className="account-portal-doc-list__meta">
                      {metaParts.join(" · ")}
                    </span>
                  </div>
                  <div className="account-portal-doc-list__actions">
                    {row.sessionId ? (
                      <Link
                        className="account-portal__btn account-portal__btn--small"
                        to="/pre-visit/my-preparations"
                        state={{ focusSessionId: row.sessionId }}
                        aria-label={`${t.downloadPrep}: ${title}`}
                      >
                        {t.downloadPrep}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
