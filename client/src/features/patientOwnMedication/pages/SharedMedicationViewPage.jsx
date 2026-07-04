import { useEffect, useMemo, useState } from "react";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { readSharePayloadFromHash } from "../shareCodec.js";
import "../styles/PatientMedicationSummary.css";

function fmtDate(iso, loc) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(loc, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

function fmtDateTime(iso, loc) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(loc, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

/**
 * Public, read-only view of a shared medication list.
 *
 * No authentication: the list is decoded entirely from the URL hash fragment,
 * so a doctor can open it by scanning the QR code without a MedScoutX account.
 * The server never receives the data (it lives after `#`).
 */
export default function SharedMedicationViewPage() {
  const [payload, setPayload] = useState(() =>
    readSharePayloadFromHash(
      typeof window !== "undefined" ? window.location.hash : "",
    ),
  );

  useEffect(() => {
    const onHash = () =>
      setPayload(readSharePayloadFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const lang = payload?.l || "de";
  const t = useMemo(() => {
    const bundle =
      getMessages(lang).patientMedicationPlan ||
      getMessages("en").patientMedicationPlan;
    return { base: bundle, s: bundle.summary || {} };
  }, [lang]);

  useEffect(() => {
    document.title = t.s.sharedPageTitle || t.s.documentTitle || "Medication list";
  }, [t]);

  const loc = getPrimaryIntlLocale(lang);
  const meds = Array.isArray(payload?.m) ? payload.m : [];

  if (!payload || meds.length === 0) {
    return (
      <div className="pmed-summary pmed-shared">
        <div className="pmed-summary__empty">
          <p className="pmed-summary__empty-title">
            {t.s.sharedInvalidTitle || "No medication list found"}
          </p>
          <p className="pmed-summary__empty-text">
            {t.s.sharedInvalidText ||
              "This link does not contain a valid medication list."}
          </p>
        </div>
      </div>
    );
  }

  const generatedLabel = payload.g
    ? (t.s.generatedAt || "Summarized on {date}").replace(
        "{date}",
        (() => {
          try {
            return new Date(payload.g).toLocaleString(loc, {
              dateStyle: "medium",
              timeStyle: "short",
            });
          } catch {
            return payload.g;
          }
        })(),
      )
    : "";
  const countLabel = (t.s.countLabel || "{count} medication(s)").replace(
    "{count}",
    String(meds.length),
  );

  return (
    <div className="pmed-summary pmed-shared">
      <div className="pmed-shared__banner" role="note">
        {t.s.sharedBanner ||
          "Shared medication list — view only. These are the patient's own statements."}
      </div>

      <section className="pmed-preview" aria-label={t.s.previewTitle}>
        <div className="pmed-preview__doc">
          <div className="pmed-preview__brand">MedScoutX</div>
          <h1 className="pmed-preview__doc-title">{t.s.documentTitle}</h1>
          <p className="pmed-preview__meta">
            {payload.n ? (
              <span className="pmed-preview__meta-name">{payload.n}</span>
            ) : null}
            {generatedLabel ? <span>{generatedLabel}</span> : null}
            <span>{countLabel}</span>
          </p>

          <ul className="pmed-preview__list">
            {meds.map((m, idx) => {
              const period =
                m.b || m.e
                  ? `${fmtDate(m.b, loc) || "…"} – ${
                      fmtDate(m.e, loc) || (t.s.ongoing || "ongoing")
                    }`
                  : "";
              return (
                <li className="pmed-preview__item" key={idx}>
                  <div className="pmed-preview__item-name">
                    <span className="pmed-preview__item-index">{idx + 1}</span>
                    {m.n || t.base.planTitleFallback}
                  </div>
                  {m.c ? (
                    <div className="pmed-preview__item-added">
                      {t.s.addedLabel} · {fmtDateTime(m.c, loc)}
                    </div>
                  ) : null}
                  <dl className="pmed-preview__grid">
                    {m.d ? (
                      <>
                        <dt>{t.base.fieldDosage}</dt>
                        <dd>{m.d}</dd>
                      </>
                    ) : null}
                    {m.s ? (
                      <>
                        <dt>{t.base.fieldSchedule}</dt>
                        <dd>{m.s}</dd>
                      </>
                    ) : null}
                    {period ? (
                      <>
                        <dt>{t.s.periodLabel}</dt>
                        <dd>{period}</dd>
                      </>
                    ) : null}
                    {m.i ? (
                      <>
                        <dt>{t.base.fieldInstructions}</dt>
                        <dd>{m.i}</dd>
                      </>
                    ) : null}
                  </dl>
                </li>
              );
            })}
          </ul>

          <p className="pmed-preview__disclaimer">{t.s.disclaimer}</p>
        </div>
      </section>

      <div className="pmed-shared__actions">
        <button
          type="button"
          className="pmed-btn pmed-btn--secondary"
          onClick={() => window.print()}
        >
          {t.s.qrPrint || "Print"}
        </button>
      </div>
    </div>
  );
}
