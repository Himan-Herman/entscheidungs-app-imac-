import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import {
  createBillingPlausibilitySession,
  fetchBillingPlausibilitySessions,
  requestBillingPlausibilityAiReview,
} from "../api/practiceBillingPlausibilityApi.js";
import "../styles/PracticeBillingPlausibilityPage.css";

const FACTOR_OPTIONS = ["0,5", "1,0", "1,5", "2,0", "2,3", "2,5", "3,0", "3,5"];

function emptyRow() {
  return { id: Date.now() + Math.random(), ziffer: "", factor: "1,0", count: "1" };
}

function rowsReducer(rows, action) {
  switch (action.type) {
    case "add":
      return [...rows, emptyRow()];
    case "remove":
      return rows.filter((r) => r.id !== action.id);
    case "update":
      return rows.map((r) =>
        r.id === action.id ? { ...r, [action.field]: action.value } : r,
      );
    case "reset":
      return [emptyRow()];
    default:
      return rows;
  }
}

export default function PracticeBillingPlausibilityPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.practiceBillingPlausibility || getMessages("en").practiceBillingPlausibility;
  }, [language]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [resultStub, setResultStub] = useState(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [context, setContext] = useState("");
  const [rows, dispatchRows] = useReducer(rowsReducer, [emptyRow()]);

  const [aiReviewPending, setAiReviewPending] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState(null);
  const [aiReviewError, setAiReviewError] = useState("");
  const [aiReviewAvailable, setAiReviewAvailable] = useState(false);

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_failed");
    return Array.isArray(data.practices) ? data.practices : [];
  }, []);

  const loadSessions = useCallback(async (pid) => {
    const { res, data } = await fetchBillingPlausibilitySessions(pid);
    if (res.status === 404 && data.error === "feature_disabled") {
      setFeatureDisabled(true);
      return;
    }
    if (res.status === 403) {
      setError(t.forbidden);
      return;
    }
    if (!res.ok) throw new Error(data.error || "load_failed");
    setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    setAiReviewAvailable(data.capabilities?.aiReview === true);
    setFeatureDisabled(false);
  }, [t.forbidden]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await loadPractices();
        if (cancelled) return;
        setPractices(list);
        const pid =
          practiceId && list.some((p) => p.id === practiceId)
            ? practiceId
            : list[0]?.id || "";
        setPracticeId(pid);
        if (pid) {
          setSearchParams({ practiceId: pid }, { replace: true });
          await loadSessions(pid);
        }
      } catch {
        if (!cancelled) setError(t.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPractices, loadSessions, practiceId, setSearchParams, t.loadError]);

  const onPracticeChange = async (e) => {
    const pid = e.target.value;
    setPracticeId(pid);
    setSearchParams({ practiceId: pid }, { replace: true });
    setLoading(true);
    setError("");
    setResultStub(null);
    try {
      await loadSessions(pid);
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!practiceId) return;
    setSubmitting(true);
    setError("");
    setStatusMsg("");
    setResultStub(null);
    try {
      const payload = {
        rows: rows.map((r) => ({
          ziffer: r.ziffer.trim(),
          factor: r.factor,
          count: r.count,
        })),
        context: context.trim() || undefined,
      };
      const { res, data } = await createBillingPlausibilitySession(practiceId, payload);
      if (!res.ok) {
        const errKey = data?.error || "submitError";
        setError(t.errors?.[errKey] || t.submitError);
        return;
      }
      setResultStub(data.session);
      setStatusMsg("");
      setAiReviewResult(null);
      setAiReviewError("");
      dispatchRows({ type: "reset" });
      setContext("");
      await loadSessions(practiceId);
    } catch {
      setError(t.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiReview = async (sessionId) => {
    if (!sessionId || aiReviewPending) return;
    setAiReviewPending(true);
    setAiReviewError("");
    setAiReviewResult(null);
    try {
      const { res, data } = await requestBillingPlausibilityAiReview(practiceId, sessionId);
      if (res.status === 404 && data?.error === "feature_disabled") {
        setAiReviewAvailable(false);
        return;
      }
      if (!res.ok) {
        setAiReviewError(t.aiReviewError || data?.error || "error");
        return;
      }
      setAiReviewResult(data.aiResult ?? data.session?.aiReview ?? null);
    } catch {
      setAiReviewError(t.aiReviewError);
    } finally {
      setAiReviewPending(false);
    }
  };

  const locale = getPrimaryIntlLocale(language);

  if (featureDisabled) {
    return (
      <main className="billing-plausibility" aria-labelledby="bp-heading">
        <p className="billing-plausibility__disabled-banner" role="note">
          {t.featureDisabled}
        </p>
      </main>
    );
  }

  return (
    <main className="billing-plausibility" aria-labelledby="bp-heading" data-testid="bp-overview-page">
      <header>
        <p>
          <Link to={`/practice/hub?practiceId=${encodeURIComponent(practiceId)}`}>
            {t.backHub}
          </Link>
        </p>
        <h1 id="bp-heading">{t.heading}</h1>
        <p className="billing-plausibility__intro">{t.intro}</p>
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

      {/* Practice selector */}
      {practices.length > 1 && (
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="bp-practice-select" style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}>
            {t.selectPractice}
          </label>
          <select id="bp-practice-select" value={practiceId} onChange={onPracticeChange}>
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.practiceName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading / error / status */}
      {loading && (
        <p className="billing-plausibility__status" aria-live="polite">
          {t.loading}
        </p>
      )}
      {error && (
        <p
          className="billing-plausibility__status billing-plausibility__status--error"
          role="alert"
        >
          {error}
        </p>
      )}
      {statusMsg && (
        <p
          className="billing-plausibility__status billing-plausibility__status--ok"
          aria-live="polite"
        >
          {statusMsg}
        </p>
      )}

      {!loading && (
        <>
          {/* Review form */}
          <section
            className="billing-plausibility__section"
            aria-labelledby="bp-form-heading"
          >
            <h2 id="bp-form-heading" className="billing-plausibility__section-heading">
              {t.btnNewReview}
            </h2>
            <form className="billing-plausibility__form" onSubmit={handleSubmit} data-testid="bp-form">
              <div className="billing-plausibility__rows" role="list" aria-label={t.labelZiffer}>
                {rows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="billing-plausibility__row"
                    role="listitem"
                  >
                    <div className="billing-plausibility__field">
                      <label
                        htmlFor={`bp-ziffer-${row.id}`}
                        className="billing-plausibility__label"
                      >
                        {t.labelZiffer}
                      </label>
                      <input
                        id={`bp-ziffer-${row.id}`}
                        className="billing-plausibility__input"
                        type="text"
                        inputMode="numeric"
                        value={row.ziffer}
                        data-testid={`bp-ziffer-input-${idx}`}
                        onChange={(e) =>
                          dispatchRows({ type: "update", id: row.id, field: "ziffer", value: e.target.value })
                        }
                        placeholder="z.B. 1"
                        required
                        aria-required="true"
                      />
                    </div>

                    <div className="billing-plausibility__field">
                      <label
                        htmlFor={`bp-factor-${row.id}`}
                        className="billing-plausibility__label"
                      >
                        {t.labelFactor}
                      </label>
                      <select
                        id={`bp-factor-${row.id}`}
                        className="billing-plausibility__input"
                        value={row.factor}
                        data-testid={`bp-factor-select-${idx}`}
                        onChange={(e) =>
                          dispatchRows({ type: "update", id: row.id, field: "factor", value: e.target.value })
                        }
                      >
                        {FACTOR_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="billing-plausibility__field">
                      <label
                        htmlFor={`bp-count-${row.id}`}
                        className="billing-plausibility__label"
                      >
                        {t.labelCount}
                      </label>
                      <input
                        id={`bp-count-${row.id}`}
                        className="billing-plausibility__input"
                        type="number"
                        min="1"
                        max="99"
                        value={row.count}
                        data-testid={`bp-count-input-${idx}`}
                        onChange={(e) =>
                          dispatchRows({ type: "update", id: row.id, field: "count", value: e.target.value })
                        }
                        required
                        aria-required="true"
                      />
                    </div>

                    <button
                      type="button"
                      className="billing-plausibility__row-remove"
                      onClick={() => dispatchRows({ type: "remove", id: row.id })}
                      aria-label={`${t.btnRemoveRow} ${idx + 1}`}
                      disabled={rows.length === 1}
                    >
                      {t.btnRemoveRow}
                    </button>
                  </div>
                ))}
              </div>

              <div className="billing-plausibility__actions">
                <button
                  type="button"
                  className="billing-plausibility__btn billing-plausibility__btn--secondary"
                  onClick={() => dispatchRows({ type: "add" })}
                >
                  {t.btnAddRow}
                </button>
              </div>

              <div className="billing-plausibility__context-field">
                <label htmlFor="bp-context" className="billing-plausibility__label">
                  {t.labelContext}
                </label>
                <textarea
                  id="bp-context"
                  className="billing-plausibility__textarea"
                  placeholder={t.contextPlaceholder}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="billing-plausibility__actions">
                <button
                  type="submit"
                  className="billing-plausibility__btn billing-plausibility__btn--primary"
                  disabled={submitting}
                  aria-busy={submitting}
                  data-testid="bp-submit-btn"
                >
                  {submitting ? t.submitting : t.btnSubmit}
                </button>
              </div>
            </form>
          </section>

          {/* Result area — shown after a session is created */}
          {resultStub && (
            <section
              className="billing-plausibility__section"
              aria-labelledby="bp-result-heading"
              aria-live="polite"
              data-testid="bp-result-section"
            >
              <h2 id="bp-result-heading" className="billing-plausibility__section-heading">
                {t.sectionResult}
              </h2>
              <p className="billing-plausibility__result-stub">{t.resultStub}</p>
              {Array.isArray(resultStub.items) && resultStub.items.length > 0 && (
                <div className="billing-plausibility__items">
                  <h3 className="billing-plausibility__items-heading">{t.sectionItems}</h3>
                  <ul className="billing-plausibility__item-list" aria-label={t.sectionItems}>
                    {resultStub.items.map((item) => {
                      const catalogueFound = item.catalogueMatchJson?.found;
                      const warnings = Array.isArray(item.warningsJson) ? item.warningsJson : [];
                      return (
                        <li key={item.id} className="billing-plausibility__item">
                          <span className="billing-plausibility__item-ziffer">
                            {item.ziffer}
                          </span>
                          <span
                            className={`billing-plausibility__item-badge ${catalogueFound ? "billing-plausibility__item-badge--found" : "billing-plausibility__item-badge--notfound"}`}
                          >
                            {catalogueFound ? t.catalogueFound : t.catalogueNotFound}
                          </span>
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
                              <p className="billing-plausibility__item-completeness">
                                {t.catalogueStatus}: {csLabel}
                              </p>
                            );
                          })()}
                          {warnings.length === 0 ? (
                            <p className="billing-plausibility__item-no-warnings">{t.noWarnings}</p>
                          ) : (
                            <ul
                              className="billing-plausibility__item-warnings"
                              aria-label={`${t.itemWarningsLabel}: ${item.ziffer}`}
                              data-testid="bp-warnings"
                            >
                              {warnings.map((code) => (
                                <li key={code} className="billing-plausibility__item-warning" data-testid="bp-warning-item">
                                  {t.warnings?.[code] || code}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <p className="billing-plausibility__manual-review-note" role="note">
                {t.manualReviewRecommended}
              </p>

              {/* AI section — separated from deterministic results; never auto-called */}
              {(aiReviewAvailable || aiReviewResult) && (
                <div className="billing-plausibility__ai-section">
                  {aiReviewAvailable && !aiReviewResult && (
                    <div className="billing-plausibility__ai-review-trigger">
                      {aiReviewError && (
                        <p
                          className="billing-plausibility__status billing-plausibility__status--error"
                          role="alert"
                        >
                          {aiReviewError}
                        </p>
                      )}
                      <button
                        type="button"
                        className="billing-plausibility__btn billing-plausibility__btn--secondary"
                        onClick={() => handleAiReview(resultStub.id)}
                        disabled={aiReviewPending}
                        aria-busy={aiReviewPending}
                      >
                        {aiReviewPending ? t.aiReviewPending : t.btnAiReview}
                      </button>
                    </div>
                  )}

                  {aiReviewResult && (
                    <div
                      className="billing-plausibility__ai-result"
                      role="note"
                      aria-label={t.aiReviewLabel}
                    >
                      <h3 className="billing-plausibility__items-heading">
                        {t.aiReviewLabel}
                      </h3>
                      <p className="billing-plausibility__ai-nonbinding">
                        {t.aiReviewNonBinding}
                      </p>

                      {aiReviewResult.fallback && (
                        <p className="billing-plausibility__ai-fallback">
                          {t.aiReviewFallback}
                        </p>
                      )}

                      {Array.isArray(aiReviewResult.rowHints) && aiReviewResult.rowHints.length > 0 && (
                        <>
                          <h4 className="billing-plausibility__items-heading billing-plausibility__items-heading--sub">
                            {t.aiReviewRowHints}
                          </h4>
                          <ul className="billing-plausibility__item-list" aria-label={t.aiReviewRowHints}>
                            {aiReviewResult.rowHints.map((rh) => (
                              <li key={rh.ziffer} className="billing-plausibility__item">
                                <span className="billing-plausibility__item-ziffer">{rh.ziffer}</span>
                                <span>{rh.hint}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {aiReviewResult.generalNote && (
                        <p className="billing-plausibility__ai-general-note">
                          <strong>{t.aiReviewGeneralNote}:</strong> {aiReviewResult.generalNote}
                        </p>
                      )}

                      {aiReviewResult.uncertaintyNote && (
                        <p className="billing-plausibility__ai-uncertainty-note">
                          <strong>{t.aiReviewUncertaintyNote}:</strong> {aiReviewResult.uncertaintyNote}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* History */}
          <section
            className="billing-plausibility__section"
            aria-labelledby="bp-history-heading"
            data-testid="bp-history-section"
          >
            <h2 id="bp-history-heading" className="billing-plausibility__section-heading">
              {t.sectionHistory}
            </h2>
            {sessions.length === 0 ? (
              <p className="billing-plausibility__empty">{t.noReviews}</p>
            ) : (
              <div className="billing-plausibility__table-wrap">
                <table className="billing-plausibility__table" data-testid="bp-history-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.colDate}</th>
                      <th scope="col">{t.colZiffernCount}</th>
                      <th scope="col">{t.colStatus}</th>
                      <th scope="col">
                        <span className="billing-plausibility__sr-only">{t.btnOpenSession}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const dateStr = s.createdAt
                        ? new Date(s.createdAt).toLocaleDateString(locale)
                        : "—";
                      const statusKey = `status${s.status?.charAt(0).toUpperCase()}${s.status?.slice(1)}`;
                      const detailHref = `/practice/settings/billing-plausibility/${encodeURIComponent(s.id)}?practiceId=${encodeURIComponent(practiceId)}`;
                      return (
                        <tr key={s.id} data-testid="bp-history-row">
                          <td>{dateStr}</td>
                          <td>{s.rowCount ?? "—"}</td>
                          <td>{t[statusKey] || s.status}</td>
                          <td>
                            <Link
                              className="billing-plausibility__table-link"
                              to={detailHref}
                              aria-label={`${t.btnOpenSession}: ${dateStr}`}
                              data-testid="bp-open-session-link"
                            >
                              {t.btnOpenSession}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
