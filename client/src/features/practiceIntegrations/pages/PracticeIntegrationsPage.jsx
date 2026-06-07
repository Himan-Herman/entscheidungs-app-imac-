import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  createIntegrationConnection,
  createIntegrationJob,
  disableIntegrationConnection,
  fetchIntegrationsOverview,
  postAiMappingSummary,
  postFhirPreview,
  testIntegrationConnection,
} from "../api/practiceIntegrationsApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/PracticeIntegrationsPage.css";

function errLabel(code, t) {
  return t.errors?.[code] || t.loadError;
}

function FlagBadge({ label, on }) {
  return (
    <li>
      <strong>{label}:</strong> {on ? "✓" : "—"}
    </li>
  );
}

export default function PracticeIntegrationsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practiceIntegrations ||
      getMessages("en").practiceIntegrations,
    [language],
  );
  const aiMark = language === "de" ? t.aiMarkedDe : t.aiMarkedEn;
  const [searchParams, setSearchParams] = useSearchParams();
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [overview, setOverview] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [aiText, setAiText] = useState("");
  const [previewJson, setPreviewJson] = useState("");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_failed");
    return Array.isArray(data.practices) ? data.practices : [];
  }, []);

  const loadOverview = useCallback(async (pid) => {
    const { res, data } = await fetchIntegrationsOverview(pid);
    if (res.status === 404 && data.error === "feature_disabled") {
      throw new Error("feature_disabled");
    }
    if (!res.ok) throw new Error(data.error || "load_failed");
    setOverview(data);
  }, []);

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
          await loadOverview(pid);
        }
      } catch (e) {
        if (!cancelled) setError(errLabel(e.message, t));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPractices, loadOverview, practiceId, setSearchParams, t]);

  const onPracticeChange = async (e) => {
    const pid = e.target.value;
    setPracticeId(pid);
    setSearchParams({ practiceId: pid }, { replace: true });
    setLoading(true);
    setError("");
    try {
      await loadOverview(pid);
    } catch (err) {
      setError(errLabel(err.message, t));
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!practiceId) return;
    await loadOverview(practiceId);
  };

  const handleCreateSandbox = async () => {
    setBusyId("create");
    setStatusMsg("");
    try {
      const { res, data } = await createIntegrationConnection(practiceId, {
        type: "pvs",
        connectorKey: "pvs_sandbox",
        status: "sandbox",
        vendorName: "Sandbox",
        authType: "none",
      });
      if (!res.ok) throw new Error(data.error || "failed");
      await refresh();
      setStatusMsg(t.testOk);
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setBusyId("");
    }
  };

  const handleTest = async (connectionId) => {
    setBusyId(connectionId);
    setStatusMsg("");
    try {
      const { res, data } = await testIntegrationConnection(practiceId, connectionId);
      if (!res.ok) throw new Error(data.error || "failed");
      setStatusMsg(data.ok ? t.testOk : t.testFailed);
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setBusyId("");
    }
  };

  const handleDisable = async (connectionId) => {
    setBusyId(`disable-${connectionId}`);
    try {
      const { res, data } = await disableIntegrationConnection(practiceId, connectionId);
      if (!res.ok) throw new Error(data.error || "failed");
      await refresh();
      setStatusMsg(t.disabled);
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setBusyId("");
    }
  };

  const handleTestJob = async (connectionId) => {
    setBusyId(`job-${connectionId}`);
    try {
      const { res, data } = await createIntegrationJob(practiceId, connectionId, {
        type: "test",
        direction: "outbound",
      });
      if (!res.ok) throw new Error(data.error || "failed");
      await refresh();
      setStatusMsg(t.jobStarted);
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setBusyId("");
    }
  };

  const handleFhirPreview = async () => {
    setBusyId("fhir");
    setPreviewJson("");
    try {
      const { res, data } = await postFhirPreview(practiceId, {
        resourceType: "Patient",
        local: { displayName: "Sandbox Patient", linkId: "sandbox-001" },
      });
      if (!res.ok) throw new Error(data.error || "failed");
      setPreviewJson(JSON.stringify(data.resource, null, 2));
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setBusyId("");
    }
  };

  const handleAiMapping = async () => {
    if (!overview?.mappings?.length) return;
    setBusyId("ai");
    setAiText("");
    try {
      const { res, data } = await postAiMappingSummary(practiceId, {
        locale: language,
        mappings: overview.mappings,
      });
      if (!res.ok) throw new Error(data.error || "failed");
      setAiText(data.text || "");
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setBusyId("");
    }
  };

  const flags = overview?.flags;

  return (
    <main className="practice-dashboard practice-integrations" aria-labelledby="practice-integrations-heading">
      <header className="practice-dashboard__header">
        <p className="practice-dashboard__eyebrow">
          <Link to={`/practice/hub?practiceId=${encodeURIComponent(practiceId)}`}>{t.backHub}</Link>
        </p>
        <h1 id="practice-integrations-heading">{t.heading}</h1>
        <p className="practice-integrations__intro">{t.intro}</p>
        <p className="practice-integrations__enterprise-note" role="note">
          {t.enterprisePathwayNote}
        </p>
      </header>

      <div className="practice-dashboard__toolbar">
        <label htmlFor="practice-integrations-select">{t.selectPractice}</label>
        <select
          id="practice-integrations-select"
          value={practiceId}
          onChange={onPracticeChange}
          aria-label={t.selectPractice}
        >
          {practices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.practiceName}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="practice-integrations__status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}
      {error ? (
        <p className="practice-integrations__status practice-integrations__status--error" role="alert">
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="practice-integrations__status practice-integrations__status--ok" aria-live="polite">
          {statusMsg}
        </p>
      ) : null}

      {overview && !loading ? (
        <>
          <section className="practice-integrations__section" aria-labelledby="pi-status-heading">
            <h2 id="pi-status-heading">{t.sectionStatus}</h2>
            <ul className="practice-integrations__flags">
              <FlagBadge label={t.flagIntegrations} on={flags?.integrationsEnabled} />
              <FlagBadge label={t.flagFhir} on={flags?.fhirEnabled} />
              <FlagBadge label={t.flagHl7} on={flags?.hl7v2Enabled} />
              <FlagBadge label={t.flagSandbox} on={flags?.sandboxEnabled} />
              <FlagBadge label={t.flagProduction} on={flags?.productionEnabled} />
            </ul>
            <p className="practice-integrations__banner" role="note">
              {t.productionWarning}
            </p>
          </section>

          <section className="practice-integrations__section" aria-labelledby="pi-connectors-heading">
            <h2 id="pi-connectors-heading">{t.sectionConnectors}</h2>
            <div className="practice-integrations__table-wrap">
              <table className="practice-integrations__table">
                <thead>
                  <tr>
                    <th scope="col">{t.connectorKey}</th>
                    <th scope="col">{t.connectionType}</th>
                    <th scope="col">{t.connectionStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview.connectors || []).map((c) => (
                    <tr key={c.key}>
                      <td>{c.name}</td>
                      <td>{c.type}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="practice-integrations__actions">
              <button
                type="button"
                className="practice-integrations__btn practice-integrations__btn--primary"
                disabled={busyId === "create"}
                onClick={handleCreateSandbox}
              >
                {t.btnCreateSandbox}
              </button>
              <Link
                className="practice-integrations__btn"
                to={`/practice/integrations/sandbox?practiceId=${encodeURIComponent(practiceId)}`}
              >
                {t.btnOpenSandbox}
              </Link>
            </div>
          </section>

          <section className="practice-integrations__section" aria-labelledby="pi-connections-heading">
            <h2 id="pi-connections-heading">{t.sectionConnections}</h2>
            {!overview.connections?.length ? (
              <p>{t.noConnections}</p>
            ) : (
              <div className="practice-integrations__table-wrap">
                <table className="practice-integrations__table">
                  <thead>
                    <tr>
                      <th scope="col">{t.connectorKey}</th>
                      <th scope="col">{t.connectionType}</th>
                      <th scope="col">{t.connectionStatus}</th>
                      <th scope="col">{t.vendorName}</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {overview.connections.map((c) => (
                      <tr key={c.id}>
                        <td>{c.connectorKey}</td>
                        <td>{c.type}</td>
                        <td>{c.status}</td>
                        <td>{c.vendorName || "—"}</td>
                        <td>
                          <div className="practice-integrations__actions">
                            <button
                              type="button"
                              className="practice-integrations__btn"
                              disabled={busyId === c.id}
                              onClick={() => handleTest(c.id)}
                              aria-label={`${t.btnTestIntegration} ${c.connectorKey}`}
                            >
                              {busyId === c.id ? t.testing : t.btnTestIntegration}
                            </button>
                            <button
                              type="button"
                              className="practice-integrations__btn"
                              disabled={busyId === `job-${c.id}`}
                              onClick={() => handleTestJob(c.id)}
                            >
                              {t.btnRunTestJob}
                            </button>
                            <button
                              type="button"
                              className="practice-integrations__btn"
                              disabled={busyId === `disable-${c.id}`}
                              onClick={() => handleDisable(c.id)}
                            >
                              {t.btnDisableConnection}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="practice-integrations__section" aria-labelledby="pi-vendors-heading">
            <h2 id="pi-vendors-heading">{t.sectionVendors}</h2>
            <p className="practice-integrations__vendor-note">{t.vendorCatalogueNote}</p>
            <ul className="practice-integrations__vendor-list" aria-label={t.sectionVendors}>
              {[
                { key: "tomedo", name: "tomedo" },
                { key: "cgm_m1", name: "CGM M1" },
                { key: "dampsoft", name: "Dampsoft" },
                { key: "medistar", name: "Medistar" },
                { key: "turbomed", name: "Turbomed" },
              ].map((vendor) => (
                <li key={vendor.key} className="practice-integrations__vendor-row">
                  <span className="practice-integrations__vendor-name">{vendor.name}</span>
                  <span className="practice-integrations__vendor-badge practice-integrations__vendor-badge--type">
                    {t.vendorTypePvs}
                  </span>
                  <span className="practice-integrations__vendor-badge practice-integrations__vendor-badge--status">
                    {t.vendorStatusPilotRequired}
                  </span>
                  <a
                    href={`mailto:contact@medscoutx.com?subject=PVS-Interesse%3A%20${encodeURIComponent(vendor.name)}`}
                    className="practice-integrations__vendor-interest"
                    aria-label={`${t.btnExpressInterest}: ${vendor.name}`}
                  >
                    {t.btnExpressInterest}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="practice-integrations__section" aria-labelledby="pi-jobs-heading">
            <h2 id="pi-jobs-heading">{t.sectionJobs}</h2>
            {!overview.recentJobs?.length ? (
              <p>{t.noJobs}</p>
            ) : (
              <div className="practice-integrations__table-wrap">
                <table className="practice-integrations__table">
                  <thead>
                    <tr>
                      <th scope="col">{t.jobType}</th>
                      <th scope="col">{t.jobDirection}</th>
                      <th scope="col">{t.jobStatus}</th>
                      <th scope="col">{t.jobCreated}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentJobs.map((j) => (
                      <tr key={j.id}>
                        <td>{j.type}</td>
                        <td>{j.direction}</td>
                        <td>{j.status}</td>
                        <td>{new Date(j.createdAt).toLocaleString(getPrimaryIntlLocale(language))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="practice-integrations__section" aria-labelledby="pi-mappings-heading">
            <h2 id="pi-mappings-heading">{t.sectionMappings}</h2>
            <pre className="practice-integrations__pre" aria-label={t.mappingPreview}>
              {JSON.stringify(overview.mappings, null, 2)}
            </pre>
            <div className="practice-integrations__actions">
              <button
                type="button"
                className="practice-integrations__btn"
                disabled={busyId === "ai"}
                onClick={handleAiMapping}
              >
                {busyId === "ai" ? t.aiLoading : t.btnAiMapping}
              </button>
              <button
                type="button"
                className="practice-integrations__btn"
                disabled={busyId === "fhir"}
                onClick={handleFhirPreview}
              >
                {t.btnFhirPreview}
              </button>
            </div>
            {previewJson ? (
              <pre className="practice-integrations__pre" aria-label={t.fhirResult}>
                {previewJson}
              </pre>
            ) : null}
            {aiText ? (
              <div className="practice-integrations__ai-box" role="note">
                <p>
                  <strong>{aiMark}</strong>
                </p>
                <p>{t.aiDisclaimer}</p>
                <p>{aiText}</p>
              </div>
            ) : null}
          </section>

          <section className="practice-integrations__section" aria-labelledby="pi-security-heading">
            <h2 id="pi-security-heading">{t.sectionSecurity}</h2>
            <p>{t.securityNote}</p>
            <p>{t.consentNote}</p>
          </section>
        </>
      ) : null}
    </main>
  );
}
