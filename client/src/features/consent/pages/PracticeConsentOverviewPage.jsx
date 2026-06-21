import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { formatUiDateTime } from "../../../i18n/intlLocale.js";
import ResponsiveTableCards from "../../../components/ResponsiveTableCards.jsx";
import { fetchPracticeConsentOverview } from "../api/practiceConsentsApi.js";
import "../styles/PracticeConsentOverviewPage.css";

const PAGE_SIZE = 50;
const STATUS_LABEL_KEYS = {
  granted: "statusActive",
  revoked: "statusRevoked",
  expired: "statusExpired",
};

export default function PracticeConsentOverviewPage() {
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceConsents || getMessages("en").practiceConsents,
    [language],
  );

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fmtDate = useCallback(
    (iso) => (iso ? formatUiDateTime(iso, language) : t.notProvided),
    [language, t.notProvided],
  );
  const typeLabel = useCallback((type) => t.types?.[type] || type, [t]);
  const statusLabel = useCallback(
    (status) => {
      const key = STATUS_LABEL_KEYS[status];
      return key && t[key] ? t[key] : status;
    },
    [t],
  );

  const load = useCallback(
    async (offset) => {
      if (!practiceId) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const first = offset === 0;
      if (first) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const { res, data } = await fetchPracticeConsentOverview(practiceId, {
          limit: PAGE_SIZE,
          offset,
        });
        if (!res.ok || !data.ok) throw new Error("load_failed");
        setTotal(Number(data.total) || 0);
        setItems((prev) => (first ? data.items || [] : [...prev, ...(data.items || [])]));
      } catch (e) {
        if (e?.message === "SESSION_EXPIRED") return;
        if (first) {
          setItems([]);
          setTotal(0);
        }
        setError(t.loadError);
      } finally {
        if (first) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [practiceId, t.loadError],
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void load(0);
  }, [load]);

  const patientHref = (linkId) =>
    `/practice/patients/${encodeURIComponent(linkId)}?practiceId=${encodeURIComponent(practiceId)}`;

  const statusCell = (status) => (
    <span className={`pco-chip pco-chip--${status}`}>{statusLabel(status)}</span>
  );

  const canLoadMore = items.length < total;

  const tableNode = (
    <table className="pco__table">
      <thead>
        <tr>
          <th scope="col">{t.colType}</th>
          <th scope="col">{t.colStatus}</th>
          <th scope="col">{t.colGranted}</th>
          <th scope="col">{t.colRevoked}</th>
          <th scope="col">{t.colExpires}</th>
          <th scope="col">{t.colVersion}</th>
          <th scope="col">{t.colPatient}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id}>
            <td>{typeLabel(row.consentType)}</td>
            <td>{statusCell(row.status)}</td>
            <td>{fmtDate(row.grantedAt)}</td>
            <td>{fmtDate(row.revokedAt)}</td>
            <td>{fmtDate(row.expiresAt)}</td>
            <td>{row.version || t.notProvided}</td>
            <td>
              {row.practicePatientLinkId ? (
                <Link to={patientHref(row.practicePatientLinkId)}>{t.patientRecordLink}</Link>
              ) : (
                t.notProvided
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const cardsNode = items.map((row) => (
    <div className="pco-card" key={row.id} role="listitem">
      <div className="pco-card__row">
        <span className="pco-card__label">{t.colType}</span>
        <span>{typeLabel(row.consentType)}</span>
      </div>
      <div className="pco-card__row">
        <span className="pco-card__label">{t.colStatus}</span>
        {statusCell(row.status)}
      </div>
      <div className="pco-card__row">
        <span className="pco-card__label">{t.colGranted}</span>
        <span>{fmtDate(row.grantedAt)}</span>
      </div>
      {row.revokedAt ? (
        <div className="pco-card__row">
          <span className="pco-card__label">{t.colRevoked}</span>
          <span>{fmtDate(row.revokedAt)}</span>
        </div>
      ) : null}
      {row.expiresAt ? (
        <div className="pco-card__row">
          <span className="pco-card__label">{t.colExpires}</span>
          <span>{fmtDate(row.expiresAt)}</span>
        </div>
      ) : null}
      <div className="pco-card__row">
        <span className="pco-card__label">{t.colVersion}</span>
        <span>{row.version || t.notProvided}</span>
      </div>
      {row.practicePatientLinkId ? (
        <div className="pco-card__row">
          <span className="pco-card__label">{t.colPatient}</span>
          <Link to={patientHref(row.practicePatientLinkId)}>{t.patientRecordLink}</Link>
        </div>
      ) : null}
    </div>
  ));

  return (
    <div className="pco">
      <Link
        className="pco__back"
        to={practiceId ? `/practice?practiceId=${encodeURIComponent(practiceId)}` : "/practice"}
      >
        {t.backLink}
      </Link>
      <h1 className="pco__title">{t.heading}</h1>
      <p className="pco__intro">{t.intro}</p>
      <p className="pco__note" role="note">
        {t.safetyNote}
      </p>

      {loading ? (
        <p className="pco__status" aria-live="polite">
          {t.loading}
        </p>
      ) : error ? (
        <p className="pco__status pco__status--error" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="pco__status">{t.emptyList}</p>
      ) : (
        <>
          <ResponsiveTableCards caption={t.heading} table={tableNode} cards={cardsNode} />
          <div className="pco__footer">
            <span className="pco__count">
              {t.resultsLabel}: {items.length} {t.of} {total}
            </span>
            {canLoadMore ? (
              <button
                type="button"
                className="pco__btn"
                onClick={() => void load(items.length)}
                disabled={loadingMore}
              >
                {loadingMore ? t.loading : t.loadMore}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
