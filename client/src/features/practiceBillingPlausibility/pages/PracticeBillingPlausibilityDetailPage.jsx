import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import {
  dismissBillingPlausibilitySession,
  downloadBillingPlausibilityReport,
  fetchBillingPlausibilitySession,
} from "../api/practiceBillingPlausibilityApi.js";
import "../styles/PracticeBillingPlausibilityPage.css";

export default function PracticeBillingPlausibilityDetailPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";

  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.practiceBillingPlausibility || getMessages("en").practiceBillingPlausibility;
  }, [language]);

  const locale = getPrimaryIntlLocale(language);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  const [dismissing, setDismissing] = useState(false);
  const [dismissSuccess, setDismissSuccess] = useState("");
  const [dismissError, setDismissError] = useState("");

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const overviewHref = practiceId
    ? `/practice/settings/billing-plausibility?practiceId=${encodeURIComponent(practiceId)}`
    : "/practice/settings/billing-plausibility";

  const loadSession = useCallback(async () => {
    if (!sessionId || !practiceId) {
      setLoadError(t.detailLoadError);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    setNotFound(false);
    try {
      const { res, data } = await fetchBillingPlausibilitySession(practiceId, sessionId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setFeatureDisabled(true);
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.status === 403) {
        setLoadError(t.forbidden);
        return;
      }
      if (!res.ok) {
        setLoadError(t.detailLoadError);
        return;
      }
      setSession(data.session);
    } catch {
      setLoadError(t.detailLoadError);
    } finally {
      setLoading(false);
    }
  }, [sessionId, practiceId, t.detailLoadError, t.forbidden]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleDismiss = async () => {
    if (!session || dismissing) return;
    setDismissing(true);
    setDismissError("");
    setDismissSuccess("");
    try {
      const { res, data } = await dismissBillingPlausibilitySession(practiceId, sessionId);
      if (!res.ok) {
        setDismissError(t.dismissError);
        return;
      }
      setSession(data.session);
      setDismissSuccess(t.dismissSuccess);
    } catch {
      setDismissError(t.dismissError);
    } finally {
      setDismissing(false);
    }
  };

  const handleDownload = async () => {
    if (!session || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const result = await downloadBillingPlausibilityReport(practiceId, sessionId, {
        format: "pdf",
        locale: language,
      });
      if (!result.ok) {
        setDownloadError(t.reportDownloadError);
      }
    } catch {
      setDownloadError(t.reportDownloadError);
    } finally {
      setDownloading(false);
    }
  };

  if (featureDisabled) {
    return (
      <main className="billing-plausibility" aria-labelledby="bp-detail-heading">
        <p>
          <Link to={overviewHref}>{t.backToBillingOverview}</Link>
        </p>
        <p className="billing-plausibility__disabled-banner" role="note">
          {t.featureDisabled}
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="billing-plausibility" aria-labelledby="bp-detail-heading">
        <p>
          <Link to={overviewHref}>{t.backToBillingOverview}</Link>
        </p>
        <p className="billing-plausibility__status" aria-live="polite">
          {t.loading}
        </p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="billing-plausibility" aria-labelledby="bp-detail-heading">
        <p>
          <Link to={overviewHref}>{t.backToBillingOverview}</Link>
        </p>
        <p className="billing-plausibility__status" role="alert">
          {t.detailNotFound}
        </p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="billing-plausibility" aria-labelledby="bp-detail-heading">
        <p>
          <Link to={overviewHref}>{t.backToBillingOverview}</Link>
        </p>
        <p
          className="billing-plausibility__status billing-plausibility__status--error"
          role="alert"
        >
          {loadError}
        </p>
      </main>
    );
  }

  if (!session) return null;

  const items = Array.isArray(session.items) ? session.items : [];
  const aiReview = session.resultSummaryJson?.aiReview ?? null;
  const isDismissed = session.status === "dismissed";

  const statusKey = `status${session.status?.charAt(0).toUpperCase()}${session.status?.slice(1)}`;
  const statusLabel = t[statusKey] || session.status;

  const createdDateStr = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString(locale)
    : "—";

  return (
    <main className="billing-plausibility" aria-labelledby="bp-detail-heading" data-testid="bp-detail-page">
      <header>
        <p>
          <Link to={overviewHref}>{t.backToBillingOverview}</Link>
        </p>
        <h1 id="bp-detail-heading">{t.heading}</h1>
      </header>

      {/* Disclaimer — always first visible content after heading */}
      <div
        className="billing-plausibility__disclaimer"
        role="note"
        aria-label={t.disclaimer}
      >
        <span className="billing-plausibility__disclaimer-icon" aria-hidden="true">
          ⚠
        </span>
        {t.disclaimer}
      </div>

      {/* Session metadata */}
      <dl className="billing-plausibility__detail-meta">
        <div className="billing-plausibility__detail-meta-item">
          <dt className="billing-plausibility__label">{t.sessionCreatedAt}</dt>
          <dd>{createdDateStr}</dd>
        </div>
        <div className="billing-plausibility__detail-meta-item">
          <dt className="billing-plausibility__label">{t.colStatus}</dt>
          <dd data-testid="bp-detail-status">{statusLabel}</dd>
        </div>
      </dl>

      {/* Dismiss / archive action */}
      {!isDismissed && (
        <div className="billing-plausibility__detail-dismiss-wrap">
          {dismissError && (
            <p
              className="billing-plausibility__status billing-plausibility__status--error"
              role="alert"
            >
              {dismissError}
            </p>
          )}
          <button
            type="button"
            className="billing-plausibility__btn billing-plausibility__btn--secondary"
            onClick={handleDismiss}
            disabled={dismissing}
            aria-busy={dismissing}
            data-testid="bp-dismiss-btn"
          >
            {t.btnDismissSession}
          </button>
        </div>
      )}

      {dismissSuccess && (
        <p
          className="billing-plausibility__status billing-plausibility__status--ok"
          aria-live="polite"
          data-testid="bp-dismiss-success"
        >
          {dismissSuccess}
        </p>
      )}

      {isDismissed && (
        <p className="billing-plausibility__detail-dismissed-note" role="status">
          {t.statusDismissed}
        </p>
      )}

      {/* Download report */}
      <div className="billing-plausibility__detail-export-wrap">
        {downloadError && (
          <p
            className="billing-plausibility__status billing-plausibility__status--error"
            role="alert"
          >
            {downloadError}
          </p>
        )}
        <button
          type="button"
          className="billing-plausibility__btn billing-plausibility__btn--secondary"
          onClick={handleDownload}
          disabled={downloading}
          aria-busy={downloading}
          data-testid="bp-download-report-btn"
        >
          {downloading ? t.reportDownloadPending : t.btnDownloadReport}
        </button>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <section
          className="billing-plausibility__section"
          aria-labelledby="bp-detail-items-heading"
        >
          <h2
            id="bp-detail-items-heading"
            className="billing-plausibility__section-heading"
          >
            {t.sectionItems}
          </h2>
          <ul className="billing-plausibility__item-list" aria-label={t.sectionItems}>
            {items.map((item) => {
              const catalogueFound = item.catalogueMatchJson?.found;
              const warnings = Array.isArray(item.warningsJson) ? item.warningsJson : [];
              return (
                <li key={item.id} className="billing-plausibility__item" data-testid="bp-detail-item">
                  <div className="billing-plausibility__item-header">
                    <span className="billing-plausibility__item-ziffer">
                      {item.ziffer}
                    </span>
                    <span className="billing-plausibility__item-meta">
                      {t.labelFactor}: {item.factor} · {t.labelCount}: {item.count}
                    </span>
                    <span
                      className={`billing-plausibility__item-badge ${catalogueFound ? "billing-plausibility__item-badge--found" : "billing-plausibility__item-badge--notfound"}`}
                    >
                      {catalogueFound ? t.catalogueFound : t.catalogueNotFound}
                    </span>
                  </div>
                  {catalogueFound && (() => {
                    const cs = item.catalogueMatchJson?.completenessStatus;
                    if (!cs) return null;
                    const csLabelMap = {
                      "verified": t.catalogueStatusVerified,
                      "points-uncertain": t.catalogueStatusPointsUncertain,
                      "needs-review": t.catalogueStatusNeedsReview,
                    };
                    const csLabel = csLabelMap[cs] ?? t.catalogueStatusUnknown;
                    return (
                      <p className="billing-plausibility__item-completeness" data-testid="bp-detail-catalogue-status">
                        {t.catalogueStatus}: {csLabel}
                      </p>
                    );
                  })()}
                  {catalogueFound && item.catalogueMatchJson?.sourceLineOrReference && (
                    <p className="billing-plausibility__item-source-ref">
                      {t.catalogueSourceReference}: {item.catalogueMatchJson.sourceLineOrReference}
                    </p>
                  )}
                  {warnings.length === 0 ? (
                    <p className="billing-plausibility__item-no-warnings">{t.noWarnings}</p>
                  ) : (
                    <ul
                      className="billing-plausibility__item-warnings"
                      aria-label={`${t.itemWarningsLabel}: ${item.ziffer}`}
                    >
                      {warnings.map((code) => (
                        <li key={code} className="billing-plausibility__item-warning">
                          {t.warnings?.[code] || code}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="billing-plausibility__manual-review-note" role="note">
            {t.manualReviewRecommended}
          </p>
        </section>
      )}

      {/* AI review — shown only if already present in session data; no new AI trigger in G1 */}
      {aiReview && (
        <section
          className="billing-plausibility__section billing-plausibility__ai-section"
          aria-labelledby="bp-detail-ai-heading"
        >
          <h2
            id="bp-detail-ai-heading"
            className="billing-plausibility__section-heading"
          >
            {t.aiReviewLabel}
          </h2>
          <div
            className="billing-plausibility__ai-result"
            role="note"
            aria-label={t.aiReviewLabel}
          >
            <p className="billing-plausibility__ai-nonbinding">{t.aiReviewNonBinding}</p>

            {aiReview.fallback && (
              <p className="billing-plausibility__ai-fallback">{t.aiReviewFallback}</p>
            )}

            {Array.isArray(aiReview.rowHints) && aiReview.rowHints.length > 0 && (
              <>
                <h3 className="billing-plausibility__items-heading billing-plausibility__items-heading--sub">
                  {t.aiReviewRowHints}
                </h3>
                <ul
                  className="billing-plausibility__item-list"
                  aria-label={t.aiReviewRowHints}
                >
                  {aiReview.rowHints.map((rh) => (
                    <li key={rh.ziffer} className="billing-plausibility__item">
                      <span className="billing-plausibility__item-ziffer">{rh.ziffer}</span>
                      <span>{rh.hint}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {aiReview.generalNote && (
              <p className="billing-plausibility__ai-general-note">
                <strong>{t.aiReviewGeneralNote}:</strong> {aiReview.generalNote}
              </p>
            )}

            {aiReview.uncertaintyNote && (
              <p className="billing-plausibility__ai-uncertainty-note">
                <strong>{t.aiReviewUncertaintyNote}:</strong> {aiReview.uncertaintyNote}
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
