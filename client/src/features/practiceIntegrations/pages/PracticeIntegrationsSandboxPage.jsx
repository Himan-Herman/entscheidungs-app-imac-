import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchIntegrationSandbox,
  postHl7Parse,
} from "../api/practiceIntegrationsApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/PracticeIntegrationsPage.css";

function errLabel(code, t) {
  return t.errors?.[code] || t.loadError;
}

export default function PracticeIntegrationsSandboxPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practiceIntegrations ||
      getMessages("en").practiceIntegrations,
    [language],
  );
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [samples, setSamples] = useState(null);
  const [hl7Out, setHl7Out] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchIntegrationSandbox(practiceId);
      if (!res.ok) throw new Error(data.error || "load_failed");
      setSamples(data.samples);
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setLoading(false);
    }
  }, [practiceId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const runHl7 = async () => {
    setBusy(true);
    setHl7Out("");
    try {
      const { res, data } = await postHl7Parse(practiceId, {
        message: samples?.hl7Message,
      });
      if (!res.ok) throw new Error(data.error || "failed");
      setHl7Out(JSON.stringify(data.parsed, null, 2));
    } catch (e) {
      setError(errLabel(e.message, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="practice-dashboard practice-integrations" aria-labelledby="sandbox-heading">
      <header className="practice-dashboard__header">
        <p className="practice-dashboard__eyebrow">
          <Link
            to={`/practice/integrations?practiceId=${encodeURIComponent(practiceId)}`}
          >
            {t.backIntegrations}
          </Link>
        </p>
        <h1 id="sandbox-heading">{t.sandboxHeading}</h1>
        <p className="practice-integrations__banner" role="note">
          {t.sandboxIntro}
        </p>
      </header>

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

      {samples ? (
        <section className="practice-integrations__section" aria-labelledby="sandbox-samples-heading">
          <h2 id="sandbox-samples-heading">{t.sandboxSamples}</h2>
          <h3>FHIR Patient</h3>
          <pre className="practice-integrations__pre">
            {JSON.stringify(samples.fhirPatient, null, 2)}
          </pre>
          <h3>FHIR DocumentReference</h3>
          <pre className="practice-integrations__pre">
            {JSON.stringify(samples.fhirDocument, null, 2)}
          </pre>
          <h3>FHIR Medication</h3>
          <pre className="practice-integrations__pre">
            {JSON.stringify(samples.fhirMedication, null, 2)}
          </pre>
          <h3>HL7 v2 (sample)</h3>
          <pre className="practice-integrations__pre">{samples.hl7Message}</pre>
          <div className="practice-integrations__actions">
            <button
              type="button"
              className="practice-integrations__btn practice-integrations__btn--primary"
              disabled={busy}
              onClick={runHl7}
              aria-label={t.btnHl7Parse}
            >
              {busy ? t.testing : t.btnHl7Parse}
            </button>
          </div>
          {hl7Out ? (
            <>
              <h3>{t.hl7Result}</h3>
              <pre className="practice-integrations__pre" aria-live="polite">
                {hl7Out}
              </pre>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
