import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchPatientPracticeLinks,
  patchPatientProfileAccess,
} from "../api/patientPracticeLinksApi.js";
import "../../../styles/PatientInboxPage.css";

function statusLabel(status, t) {
  const map = {
    active: t.statusActive,
    invited: t.statusInvited,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

export default function PatientPracticeLinksPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientPracticeLinks ||
      getMessages("en").patientPracticeLinks,
    [language],
  );

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientPracticeLinks({ status: "active" });
      if (res.status === 404 && data.error === "feature_disabled") {
        setLinks([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      const all = Array.isArray(data.links) ? data.links : [];
      setLinks(all.filter((l) => l.status === "active" || l.status === "invited"));
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLinks([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleProfile(link, grant) {
    setBusyId(link.id);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await patchPatientProfileAccess(link.id, grant);
      if (!res.ok || !data.ok) {
        setError(t.saveError);
        return;
      }
      setStatusMsg(grant ? t.savedGranted : t.savedRevoked);
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, ...data.link } : l)),
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
      </header>

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="patient-inbox__muted" role="status">
          {statusMsg}
        </p>
      ) : null}

      {!loading && !error && links.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && links.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {links.map((link) => {
            const practiceName = link.practice?.practiceName || "—";
            const granted = Boolean(link.profileAccessGranted);
            const st = statusLabel(link.status, t);

            return (
              <li key={link.id} className="patient-inbox__item" style={{ padding: "1rem" }}>
                <p className="patient-inbox__item-title">{practiceName}</p>
                <p className="patient-inbox__item-meta">{st}</p>
                <fieldset style={{ border: "none", margin: "0.75rem 0 0", padding: 0 }}>
                  <legend className="patient-inbox__item-title" style={{ fontSize: "1rem" }}>
                    {t.shareProfileTitle}
                  </legend>
                  <p className="patient-inbox__muted">{t.shareProfileHint}</p>
                  <p className="patient-inbox__item-meta" role="status">
                    {granted ? t.profileAccessOn : t.profileAccessOff}
                  </p>
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    style={{ marginTop: "0.5rem" }}
                    disabled={busyId === link.id}
                    aria-pressed={granted}
                    onClick={() => toggleProfile(link, !granted)}
                  >
                    {granted ? t.disableProfile : t.enableProfile}
                  </button>
                </fieldset>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
