import { useMemo } from "react";
import { analyzeMedications } from "../pharmacyAssistant/pharmacyAssistant.js";

/**
 * Renders the deterministic pharmacy-assistant findings.
 *
 * Accessibility: severity is conveyed by a TEXT label ("Wichtig"/"Hinweis"), not
 * colour or icon alone (WCAG 1.4.1). Icons are decorative (aria-hidden). Each
 * finding is a list item with its own heading; the intro/none/disclaimer are
 * marked as notes.
 *
 * @param {object} props
 * @param {Array} props.entries  Own-medication entries.
 * @param {object} props.t       `summary.pharmacy` i18n block.
 */
export default function PharmacyAssistantPanel({ entries, t }) {
  const findings = useMemo(
    () =>
      analyzeMedications(
        entries,
        (id, field) => (t.rules && t.rules[id] && t.rules[id][field]) || "",
      ),
    [entries, t],
  );

  return (
    <section className="pharm" aria-labelledby="pharm-title">
      <h2 id="pharm-title" className="pharm__title">
        {t.title}
      </h2>
      <p className="pharm__intro" role="note">
        {t.intro}
      </p>

      {findings.length === 0 ? (
        <p className="pharm__none" role="note">
          {t.none}
        </p>
      ) : (
        <ul className="pharm__list" role="list">
          {findings.map((f) => {
            const severityLabel =
              f.severity === "warning" ? t.severityWarning : t.severityInfo;
            return (
              <li
                key={f.id}
                className={`pharm__item pharm__item--${f.severity}`}
                aria-label={`${severityLabel}: ${f.title}`}
              >
                <div className="pharm__badge" aria-hidden="true">
                  {f.severity === "warning" ? "⚠" : "ℹ"}
                </div>
                <div className="pharm__body">
                  <p className="pharm__severity">{severityLabel}</p>
                  <h3 className="pharm__item-title">{f.title}</h3>
                  {f.meds.length > 0 ? (
                    <p className="pharm__meds">
                      <span className="pharm__meds-label">{t.medsLabel}:</span>{" "}
                      {f.meds.join(", ")}
                    </p>
                  ) : null}
                  <p className="pharm__message">{f.message}</p>
                  <p className="pharm__talk">{t.talkTo}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="pharm__disclaimer" role="note">
        {t.disclaimer}
      </p>
    </section>
  );
}
