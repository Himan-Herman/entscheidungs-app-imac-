import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { practiceDisplayName } from "../../../api/practicesApi.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  createApiClient,
  createWebhookEndpoint,
  fetchApiClients,
  fetchDeveloperMeta,
  fetchWebhookDeliveries,
  fetchWebhookEndpoints,
  revokeApiClient,
  testWebhookEndpoint,
} from "../api/practiceDeveloperApi.js";
import "../../../styles/PracticeDashboardPage.css";

export default function PracticeDeveloperPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceDeveloper || getMessages("en").practiceDeveloper,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [clients, setClients] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [meta, setMeta] = useState({ scopes: [], webhookEvents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tokenOnce, setTokenOnce] = useState("");
  const [secretOnce, setSecretOnce] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [clientForm, setClientForm] = useState({ name: "", scopes: ["read:practice"] });
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    url: "",
    eventTypes: ["test.ping", "document.shared"],
  });
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const reload = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    setError("");
    const m = await fetchDeveloperMeta(pid);
    if (m.res.ok && m.data.ok) setMeta(m.data);

    const c = await fetchApiClients(pid);
    if (c.res.status === 404) setError(t.featureDisabled);
    else if (c.res.status === 403) setError(t.forbidden);
    else if (c.res.ok && c.data.ok) setClients(c.data.clients || []);

    const w = await fetchWebhookEndpoints(pid);
    if (w.res.ok && w.data.ok) setEndpoints(w.data.endpoints || []);

    setLoading(false);
  }, [t.featureDisabled, t.forbidden]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void (async () => {
      const res = await authFetch("/api/practices");
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.practices) ? data.practices : [];
      setPractices(list);
      const pid = searchParams.get("practiceId") || list[0]?.id || "";
      setPracticeId(pid);
      if (pid) await reload(pid);
      else setLoading(false);
    })();
  }, [reload, searchParams]);

  const onCreateClient = async () => {
    const { res, data } = await createApiClient(practiceId, clientForm);
    if (res.ok && data.ok) {
      setTokenOnce(data.token || "");
      setStatusMsg(t.saved);
      await reload(practiceId);
    }
  };

  const onCreateWebhook = async () => {
    const { res, data } = await createWebhookEndpoint(practiceId, webhookForm);
    if (res.ok && data.ok) {
      setSecretOnce(data.signingSecret || "");
      setStatusMsg(t.saved);
      await reload(practiceId);
    } else if (data.error === "encryption_not_configured") {
      setError(t.encryptionRequired);
    }
  };

  const loadDeliveries = async (endpointId) => {
    setSelectedEndpoint(endpointId);
    const { res, data } = await fetchWebhookDeliveries(practiceId, endpointId);
    if (res.ok && data.ok) setDeliveries(data.deliveries || []);
  };

  return (
    <main className="practice-dashboard" lang={language}>
      <nav>
        <Link to={`/practice?practiceId=${encodeURIComponent(practiceId)}`}>{t.backHub}</Link>
      </nav>
      <h1>{t.heading}</h1>
      <p>{t.intro}</p>
      <p role="note">{t.securityNote}</p>

      <label htmlFor="dev-practice">{t.selectPractice}</label>
      <select
        id="dev-practice"
        value={practiceId}
        onChange={(e) => {
          const pid = e.target.value;
          setPracticeId(pid);
          setSearchParams(pid ? { practiceId: pid } : {});
          void reload(pid);
        }}
      >
        {practices.map((p) => (
          <option key={p.id} value={p.id}>
            {practiceDisplayName(p)}
          </option>
        ))}
      </select>

      {loading ? <p aria-live="polite">{t.loading}</p> : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}
      {statusMsg ? <p aria-live="polite">{statusMsg}</p> : null}

      <section aria-labelledby="dev-api-heading">
        <h2 id="dev-api-heading">{t.apiClients}</h2>
        <label htmlFor="dev-client-name">{t.clientName}</label>
        <input
          id="dev-client-name"
          value={clientForm.name}
          onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
        />
        <fieldset>
          <legend>{t.scopes}</legend>
          {(meta.scopes || []).map((scope) => (
            <label key={scope} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={clientForm.scopes.includes(scope)}
                onChange={(e) => {
                  setClientForm((f) => ({
                    ...f,
                    scopes: e.target.checked
                      ? [...f.scopes, scope]
                      : f.scopes.filter((s) => s !== scope),
                  }));
                }}
              />{" "}
              {scope}
            </label>
          ))}
        </fieldset>
        <button type="button" className="patient-threads__btn patient-threads__btn--primary" onClick={() => void onCreateClient()}>
          {t.createClient}
        </button>
        {tokenOnce ? (
          <p role="alert">
            <strong>{t.tokenOnce}:</strong> <code>{tokenOnce}</code>
          </p>
        ) : null}
        <ul>
          {clients.map((c) => (
            <li key={c.id}>
              {c.name} — {c.status}
              {c.status === "active" ? (
                <button
                  type="button"
                  className="patient-threads__btn patient-threads__btn--secondary"
                  onClick={() => void revokeApiClient(practiceId, c.id).then(() => reload(practiceId))}
                >
                  {t.revokeToken}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dev-wh-heading">
        <h2 id="dev-wh-heading">{t.webhookEndpoints}</h2>
        <label htmlFor="dev-wh-name">{t.webhookName}</label>
        <input
          id="dev-wh-name"
          value={webhookForm.name}
          onChange={(e) => setWebhookForm((f) => ({ ...f, name: e.target.value }))}
        />
        <label htmlFor="dev-wh-url">{t.webhookUrl}</label>
        <input
          id="dev-wh-url"
          value={webhookForm.url}
          onChange={(e) => setWebhookForm((f) => ({ ...f, url: e.target.value }))}
        />
        <fieldset>
          <legend>{t.events}</legend>
          {(meta.webhookEvents || []).slice(0, 12).map((ev) => (
            <label key={ev} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={webhookForm.eventTypes.includes(ev)}
                onChange={(e) => {
                  setWebhookForm((f) => ({
                    ...f,
                    eventTypes: e.target.checked
                      ? [...f.eventTypes, ev]
                      : f.eventTypes.filter((x) => x !== ev),
                  }));
                }}
              />{" "}
              {ev}
            </label>
          ))}
        </fieldset>
        <button type="button" className="patient-threads__btn patient-threads__btn--primary" onClick={() => void onCreateWebhook()}>
          {t.createWebhook}
        </button>
        {secretOnce ? (
          <p role="alert">
            <strong>{t.signingSecretOnce}:</strong> <code>{secretOnce}</code>
          </p>
        ) : null}
        <ul>
          {endpoints.map((ep) => (
            <li key={ep.id}>
              {ep.name} — {ep.url} — {ep.status}
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                onClick={() => void testWebhookEndpoint(practiceId, ep.id).then(() => {
                  setStatusMsg(t.testEvent);
                  void loadDeliveries(ep.id);
                })}
              >
                {t.sendTestWebhook}
              </button>
              <button type="button" className="patient-threads__btn" onClick={() => void loadDeliveries(ep.id)}>
                {t.deliveries}
              </button>
            </li>
          ))}
        </ul>
        {selectedEndpoint && deliveries.length > 0 ? (
          <table aria-label={t.deliveries}>
            <thead>
              <tr>
                <th scope="col">{t.status}</th>
                <th scope="col">HTTP</th>
                <th scope="col">Error</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.status}</td>
                  <td>{d.lastStatusCode ?? "—"}</td>
                  <td>{d.lastErrorCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
