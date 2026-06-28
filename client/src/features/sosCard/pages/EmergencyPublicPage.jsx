import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Phone, Pill, ShieldAlert, Stethoscope } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { fetchPublicEmergency } from "../api/sosCardApi.js";
import { getEmergencyStrings } from "../emergencyI18n.js";
import { emergencyLanguageLabel, isRtlEmergencyLang } from "../emergencyLanguages.js";
import "../styles/SosCard.css";

const SEVERITY_ORDER = { life_threatening: 0, severe: 1, moderate: 2, mild: 3 };

export default function EmergencyPublicPage() {
  const { token } = useParams();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Page locale: prefer the patient's chosen emergency language, else the site language.
  // Self-contained translations (no app-i18n dependency) so codes like kmr/ur work and there
  // is no mixed language for the public emergency strings.
  const localeCode = data?.preferredEmergencyLanguage || language || "en";
  const isRtl = isRtlEmergencyLang(localeCode);
  const t = useMemo(
    () => getEmergencyStrings(data?.preferredEmergencyLanguage, language),
    [data, language],
  );

  useEffect(() => {
    document.title = "Emergency Medical Card";
    if (!token) { setError("invalid_token"); setLoading(false); return; }
    fetchPublicEmergency(token)
      .then(({ res, data: d }) => {
        if (!res.ok || !d.ok) {
          setError(d?.error === "card_not_found" ? "not_found" : "error");
        } else {
          setData(d);
        }
      })
      .catch(() => setError("error"))
      .finally(() => setLoading(false));
  }, [token]);

  // Defense-in-depth: keep this public page out of search indexes (in addition to the
  // X-Robots-Tag header the API already sends). Injected at mount, removed on unmount.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Render the page in the emergency language: set <html lang> + dir (rtl for ar/fa/ckb/ur).
  // Previous values are restored on unmount so the rest of the app keeps its own direction.
  useEffect(() => {
    const html = document.documentElement;
    const prevLang = html.getAttribute("lang");
    const prevDir = html.getAttribute("dir");
    html.setAttribute("lang", localeCode);
    html.setAttribute("dir", isRtl ? "rtl" : "ltr");
    return () => {
      if (prevLang === null) html.removeAttribute("lang");
      else html.setAttribute("lang", prevLang);
      if (prevDir === null) html.removeAttribute("dir");
      else html.setAttribute("dir", prevDir);
    };
  }, [localeCode, isRtl]);

  if (loading) {
    return (
      <main className="emergency-card">
        <p className="emergency-card__status" role="status">{t.loading}</p>
      </main>
    );
  }

  if (error === "not_found") {
    return (
      <main className="emergency-card">
        <div className="emergency-card__sos-badge">
          <ShieldAlert size={20} aria-hidden="true" /> {t.sosBadge}
        </div>
        <p className="emergency-card__status">{t.notFound}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="emergency-card">
        <p className="emergency-card__status emergency-card__status--error" role="alert">
          {t.loadFailed}
        </p>
      </main>
    );
  }

  const allergies = Array.isArray(data.allergies) ? data.allergies : [];
  const sortedAllergies = [...allergies].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
  const criticalAllergies = sortedAllergies.filter(
    (a) => a.severity === "life_threatening" || a.severity === "severe",
  );
  const otherAllergies = sortedAllergies.filter(
    (a) => a.severity !== "life_threatening" && a.severity !== "severe",
  );

  const medications = Array.isArray(data.medications) ? data.medications : [];
  const implants = Array.isArray(data.implants) ? data.implants : [];
  const diagnoses = Array.isArray(data.diagnoses) ? data.diagnoses : [];
  const contacts = Array.isArray(data.emergencyContacts) ? data.emergencyContacts : [];

  // Identity scalars released by the patient (the API already nulls hidden fields).
  const identity = [
    typeof data.age === "number" && { label: t.age, value: `${data.age}` },
    data.dateOfBirth && {
      label: t.dateOfBirth,
      value: new Date(data.dateOfBirth).toLocaleDateString(),
    },
    data.biologicalSex && {
      label: t.biologicalSex,
      value: t.biologicalSexValues?.[data.biologicalSex] || data.biologicalSex,
    },
    typeof data.heightCm === "number" && { label: t.height, value: `${data.heightCm} cm` },
    typeof data.weightKg === "number" && { label: t.weight, value: `${data.weightKg} kg` },
    data.pregnancyStatus && {
      label: t.pregnancy,
      value: t.pregnancyValues?.[data.pregnancyStatus] || data.pregnancyStatus,
    },
  ].filter(Boolean);

  return (
    <main className="emergency-card" lang={localeCode} dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. SOS header */}
      <div className="emergency-card__sos-badge">
        <ShieldAlert size={22} aria-hidden="true" />
        {t.sosBadge}
      </div>

      {/* 2. Name / identification */}
      <h1 className="emergency-card__name">
        {data.patient?.firstName} {data.patient?.lastName}
      </h1>

      {identity.length > 0 && (
        <section className="emergency-card__block" aria-label={t.identification}>
          <h2 className="emergency-card__block-title">{t.identification}</h2>
          <dl className="emergency-card__meta-grid">
            {identity.map((item, i) => (
              <div key={i} className="emergency-card__meta-item">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 3. Blood type */}
      {data.bloodType && (
        <section className="emergency-card__block emergency-card__block--critical" aria-label={t.bloodType}>
          <h2 className="emergency-card__block-title">{t.bloodType}</h2>
          <div className="emergency-card__blood-type">{data.bloodType}</div>
        </section>
      )}

      {/* 4. Allergies — critical first */}
      {criticalAllergies.length > 0 && (
        <section className="emergency-card__block emergency-card__block--critical" aria-label={t.criticalAllergies}>
          <h2 className="emergency-card__block-title">
            <AlertTriangle size={16} aria-hidden="true" style={{ display: "inline", marginRight: "0.35rem" }} />
            {t.criticalAllergies}
          </h2>
          {criticalAllergies.map((a, i) => (
            <div key={i} className="emergency-card__allergy-item">
              <span className={`emergency-card__severity-badge emergency-card__severity-badge--${a.severity}`}>
                {t.severities?.[a.severity] || a.severity}
              </span>
              <span>
                {a.allergen}
                {a.reaction ? ` — ${a.reaction}` : ""}
              </span>
            </div>
          ))}
        </section>
      )}

      {otherAllergies.length > 0 && (
        <section className="emergency-card__block" aria-label={t.otherAllergies}>
          <h2 className="emergency-card__block-title">{t.otherAllergies}</h2>
          {otherAllergies.map((a, i) => (
            <div key={i} className="emergency-card__allergy-item">
              <span className={`emergency-card__severity-badge emergency-card__severity-badge--${a.severity}`}>
                {t.severities?.[a.severity] || a.severity}
              </span>
              <span>
                {a.allergen}
                {a.reaction ? ` — ${a.reaction}` : ""}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* 5. Medications */}
      {medications.length > 0 && (
        <section className="emergency-card__block" aria-label={t.medications}>
          <h2 className="emergency-card__block-title">
            <Pill size={16} aria-hidden="true" style={{ display: "inline", marginRight: "0.35rem" }} />
            {t.medications}
          </h2>
          <ul className="emergency-card__list">
            {medications.map((m, i) => (
              <li key={i}>
                <strong>{m.name}</strong>
                {m.dose ? ` · ${m.dose}` : ""}
                {m.frequency ? ` · ${m.frequency}` : ""}
                {m.instruction ? ` — ${m.instruction}` : ""}
                {m.note ? ` (${m.note})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. Diagnoses / conditions */}
      {diagnoses.length > 0 && (
        <section className="emergency-card__block" aria-label={t.diagnoses}>
          <h2 className="emergency-card__block-title">
            <Stethoscope size={16} aria-hidden="true" style={{ display: "inline", marginRight: "0.35rem" }} />
            {t.diagnoses}
          </h2>
          <ul className="emergency-card__list">
            {diagnoses.map((d, i) => (
              <li key={i}>
                {d.condition}
                {d.icdCode ? ` (${d.icdCode})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7. Implants / devices */}
      {implants.length > 0 && (
        <section className="emergency-card__block" aria-label={t.implants}>
          <h2 className="emergency-card__block-title">{t.implants}</h2>
          <ul className="emergency-card__list">
            {implants.map((m, i) => (
              <li key={i}>
                <strong>{m.name}</strong>
                {m.bodyRegion ? ` · ${m.bodyRegion}` : ""}
                {m.manufacturer ? ` · ${m.manufacturer}` : ""}
                {m.note ? ` (${m.note})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 8. Emergency contacts */}
      {contacts.length > 0 && (
        <section className="emergency-card__block" aria-label={t.contacts}>
          <h2 className="emergency-card__block-title">
            <Phone size={16} aria-hidden="true" style={{ display: "inline", marginRight: "0.35rem" }} />
            {t.contacts}
          </h2>
          {contacts.map((c, i) => (
            <div key={i} className="emergency-card__contact">
              <strong>{c.name}</strong>{" "}
              <a href={`tel:${c.phone}`} aria-label={`${t.callAria}: ${c.name} ${c.phone}`}>{c.phone}</a>
            </div>
          ))}
        </section>
      )}

      {/* 9. Language & notes */}
      {data.preferredEmergencyLanguage && (
        <section className="emergency-card__block" aria-label={t.language}>
          <h2 className="emergency-card__block-title">{t.language}</h2>
          <p>{emergencyLanguageLabel(data.preferredEmergencyLanguage)}</p>
        </section>
      )}

      {data.firstResponderNote && (
        <section className="emergency-card__block" aria-label={t.note}>
          <h2 className="emergency-card__block-title">{t.note}</h2>
          <p className="emergency-card__pre">{data.firstResponderNote}</p>
        </section>
      )}

      {data.aiSummary && (
        <section className="emergency-card__block" aria-label={t.aiSummary}>
          <h2 className="emergency-card__block-title">{t.aiSummary}</h2>
          <p className="emergency-card__pre">{data.aiSummary}</p>
        </section>
      )}

      <p className="emergency-card__footer">{t.notValidated}</p>
    </main>
  );
}
