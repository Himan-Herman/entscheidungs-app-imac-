import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchPracticeDataRequests,
  fetchPracticeDataRequest,
} from "../api/patientDataControlApi.js";
import PracticeDataRequestActions from "../components/PracticeDataRequestActions.jsx";
import RequestStatus from "../components/RequestStatus.jsx";
import { statusLabel } from "../lib/dataRequestStatus.js";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";
import "../../../styles/PatientDataControlPage.css";
import ResponsiveTableCards from "../../../components/ResponsiveTableCards.jsx";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function typeLabel(type, t) {
  const map = {
    deletion: t.typeDeletion,
    access_restriction: t.typeAccessRestriction,
    export: t.typeExport,
  };
  return map[type] || type;
}

function patientName(row) {
  const p = row.patient;
  if (!p) return "—";
  const parts = [p.firstName, p.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export default function PracticeDataRequestsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practiceDataRequests ||
      getMessages("en").practiceDataRequests,
    [language],
  );
  // The action texts live with the patient record, where the same actions sit.
  const tPatients = getMessages(language).practicePatients || getMessages("en").practicePatients;
  const [searchParams, setSearchParams] = useSearchParams();

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [readOnly, setReadOnly] = useState(false);

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_practices_failed");
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows.length > 0) {
      setPracticeId(rows[0].id);
    }
  }, [practiceId]);

  const loadRequests = useCallback(async () => {
    if (!practiceId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeDataRequests(practiceId);
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setRequests([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.loadError]);

  const loadDetail = useCallback(
    async (requestId) => {
      if (!practiceId || !requestId) return;
      setDetailLoading(true);
      setDetail(null);
      try {
        const { res, data } = await fetchPracticeDataRequest(practiceId, requestId);
        if (res.status === 403) {
          setReadOnly(true);
          return;
        }
        if (!res.ok || !data.ok) throw new Error("load_failed");
        setDetail(data.request);
        setCapabilities(data.capabilities || null);
      } catch {
        setError(t.loadError);
      } finally {
        setDetailLoading(false);
      }
    },
    [practiceId, t.loadError],
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadPractices().catch(() => setError(t.loadError));
  }, [loadPractices, t.loadError]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!practiceId) return;
    const next = new URLSearchParams(searchParams);
    next.set("practiceId", practiceId);
    setSearchParams(next, { replace: true });
  }, [practiceId, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  /** After an action: refresh the list and the open detail. */
  async function afterAction() {
    await loadRequests();
    if (selectedId) await loadDetail(selectedId);
  }

  return (
    <div className="practice-dashboard">
      <Link className="practice-dashboard__back" to="/practice">
        {t.backHub}
      </Link>
      <header className="practice-dashboard__header">
        <h1>{t.heading}</h1>
        <p className="practice-dashboard__sub">{t.intro}</p>
      </header>

      {practices.length > 1 ? (
        <label className="practice-dashboard__filter">
          <span>{t.selectPractice}</span>
          <select value={practiceId} onChange={(e) => setPracticeId(e.target.value)}>
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.practiceName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loading ? <p>{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && requests.length === 0 ? <p>{t.empty}</p> : null}

      {!loading && !error && requests.length > 0 ? (
        <ResponsiveTableCards
          caption={t.listCaption}
          table={
            <table className="practice-patients__table">
              <caption className="practice-team__sr-only">{t.listCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.colPatient}</th>
                  <th scope="col">{t.colType}</th>
                  <th scope="col">{t.colStatus}</th>
                  <th scope="col">{t.colDate}</th>
                  <th scope="col">{t.colLink}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    aria-selected={selectedId === row.id}
                    onClick={() => setSelectedId(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(row.id);
                      }
                    }}
                  >
                    <td>{patientName(row)}</td>
                    <td>{typeLabel(row.type, t)}</td>
                    <td>{statusLabel(row.status, t)}</td>
                    <td>{fmt(row.createdAt, language)}</td>
                    <td>{row.link?.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          cards={requests.map((row) => {
            const selected = selectedId === row.id;
            return (
              <article
                key={row.id}
                className={`practice-patients__card-item ms-responsive-list__card${selected ? " practice-patients__card-item--selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => setSelectedId(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(row.id);
                  }
                }}
              >
                <h2 className="practice-dashboard__muted" style={{ margin: 0, fontSize: "1rem" }}>
                  {patientName(row)}
                </h2>
                <dl className="ms-responsive-list__card-row">
                  <dt>{t.colType}</dt>
                  <dd>{typeLabel(row.type, t)}</dd>
                  <dt>{t.colStatus}</dt>
                  <dd>{statusLabel(row.status, t)}</dd>
                  <dt>{t.colDate}</dt>
                  <dd>
                    <time dateTime={row.createdAt}>{fmt(row.createdAt, language)}</time>
                  </dd>
                  <dt>{t.colLink}</dt>
                  <dd>{row.link?.status || "—"}</dd>
                </dl>
              </article>
            );
          })}
        />
      ) : null}

      {selectedId ? (
        <dialog
          open
          className="patient-data-control__dialog"
          style={{ marginTop: "1.5rem", maxWidth: "32rem" }}
          aria-labelledby="practice-req-detail-title"
        >
          <h2 id="practice-req-detail-title" className="patient-data-control__dialog-title">
            {t.detailTitle}
          </h2>
          {detailLoading ? <p>{t.loading}</p> : null}
          {detail && !detailLoading ? (
            <>
              <p className="patient-data-control__dialog-body">
                {patientName(detail)} — {typeLabel(detail.type, t)}
              </p>
              <p className="practice-dashboard__muted">
                <RequestStatus status={detail.status} label={statusLabel(detail.status, t)} />
                {" · "}{fmt(detail.createdAt, language)}
              </p>
              <p>
                <strong>{t.detailReason}:</strong> {detail.reason?.trim() || t.detailNoReason}
              </p>
              {detail.practicePatientLinkId ? (
                <p style={{ marginTop: "0.75rem" }}>
                  <Link
                    to={`/practice/patients/${detail.practicePatientLinkId}?practiceId=${encodeURIComponent(practiceId)}`}
                  >
                    {t.openPatient}
                  </Link>
                </p>
              ) : null}
              {detail.responseNote ? (
                <p style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap" }}>
                  <strong>{t.detailResponseNote}:</strong> {detail.responseNote}
                </p>
              ) : null}
              {!readOnly && (capabilities?.triage || capabilities?.answer) ? (
                <PracticeDataRequestActions
                  practiceId={practiceId}
                  request={detail}
                  capabilities={capabilities}
                  onSaved={afterAction}
                  t={tPatients}
                  idPrefix="pdr"
                />
              ) : (
                <p className="practice-dashboard__muted" role="note">
                  {t.viewerReadOnly}
                </p>
              )}
            </>
          ) : null}
          <div className="patient-data-control__dialog-actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              onClick={() => {
                setSelectedId("");
                setDetail(null);
              }}
            >
              {t.detailClose}
            </button>
          </div>
        </dialog>
      ) : null}

      <p style={{ marginTop: "1.5rem" }}>
        <Link to={`/practice/patients?practiceId=${encodeURIComponent(practiceId)}`}>
          {t.backPatients}
        </Link>
      </p>
    </div>
  );
}
