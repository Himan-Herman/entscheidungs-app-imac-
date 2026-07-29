import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchVitals } from "../../vitals/api/vitalsApi.js";
import { fetchVaccinations } from "../../vaccinations/api/vaccinationsApi.js";
import { fetchAllergies, fetchDiagnoses } from "../../healthHistory/api/healthHistoryApi.js";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import { usePracticeContextIndex } from "../hooks/usePracticeContextIndex.js";
import { splitByProvenance, recordsForLink } from "../lib/splitByProvenance.js";
import ProvenanceBadge from "../components/ProvenanceBadge.jsx";
import PracticeSwitcher from "../components/PracticeSwitcher.jsx";
import SharedDataSection from "../components/SharedDataSection.jsx";
import "./PatientDataByPracticePage.css";

/** The four patient-owned record types that carry a data scope. */
const SECTIONS = [
  { key: "vitals", fetch: fetchVitals, pick: (d) => d.entries },
  { key: "vaccinations", fetch: fetchVaccinations, pick: (d) => d.entries },
  { key: "allergies", fetch: fetchAllergies, pick: (d) => d.entries },
  { key: "diagnoses", fetch: fetchDiagnoses, pick: (d) => d.entries },
];

/** A short, non-clinical line for one record — enough to recognise it. */
function recordTitle(section, record) {
  if (section === "vitals") return `${record.type ?? ""} ${record.valuePrimary ?? ""}${record.valueSecondary ? `/${record.valueSecondary}` : ""} ${record.unit ?? ""}`.trim();
  if (section === "vaccinations") return record.vaccineName || record.disease || "";
  if (section === "allergies") return record.allergen || "";
  return record.conditionName || "";
}

export default function PatientDataByPracticePage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.patientPractices || getMessages("en").patientPractices;
  }, [language]);
  const tShare = useMemo(
    () => getMessages(language).documentSharing || getMessages("en").documentSharing,
    [language],
  );

  const { activeLinks, inactiveLinks, resolve, loading: linksLoading, error: linksError, reload } =
    usePracticeContextIndex();

  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeLinkId, setActiveLinkId] = useState("");
  const aliveRef = useRef(true);

  useEffect(() => {
    if (t?.pageTitle) document.title = t.pageTitle;
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        SECTIONS.map(async (s) => {
          const { res, data } = await s.fetch();
          if (res.status === 404) return [s.key, []];
          if (!res.ok || !data.ok) throw new Error("load_failed");
          const list = s.pick(data);
          return [s.key, Array.isArray(list) ? list : []];
        }),
      );
      if (!aliveRef.current) return;
      setRecords(Object.fromEntries(results));
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      if (aliveRef.current) setError(t.loadError);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => { aliveRef.current = false; };
  }, [load]);

  // Default to the first practice, and follow along if it disappears.
  useEffect(() => {
    if (activeLinks.length === 0) { setActiveLinkId(""); return; }
    if (!activeLinks.some((l) => l.id === activeLinkId)) {
      setActiveLinkId(activeLinks[0].id);
    }
  }, [activeLinks, activeLinkId]);

  const split = useMemo(() => {
    const out = {};
    for (const s of SECTIONS) {
      out[s.key] = splitByProvenance(records[s.key] ?? [], resolve);
    }
    return out;
  }, [records, resolve]);

  const activeIndex = activeLinks.findIndex((l) => l.id === activeLinkId);
  const activeLink = activeIndex >= 0 ? activeLinks[activeIndex] : null;

  const busy = loading || linksLoading;

  function renderList(sectionKey, list) {
    if (!list || list.length === 0) return null;
    return (
      <ul className="patient-data-practice__list">
        {list.map((record) => (
          <li key={record.id} className="patient-data-practice__item">
            <span className="patient-data-practice__record">{recordTitle(sectionKey, record)}</span>
            <ProvenanceBadge
              practiceContextState={record.practiceContextState}
              dataScope={record.dataScope}
              contextPracticePatientLinkId={record.contextPracticePatientLinkId}
              archivedPractice={record.archivedPractice}
              source={record.source}
              language={language}
              resolve={resolve}
              t={t}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="patient-data-practice">
      <h1 className="patient-data-practice__heading">{t.heading}</h1>
      <p className="patient-data-practice__intro">{t.intro}</p>

      <div role="status" aria-live="polite" className="patient-data-practice__status">
        {busy ? t.loading : ""}
      </div>

      {(error || linksError) && (
        <div className="patient-data-practice__error" role="alert">
          <p>{t.loadError}</p>
          <button type="button" onClick={() => { void load(); void reload(); }}>
            {t.retry}
          </button>
        </div>
      )}

      {/* ---------------------------------------------- A. the patient's own data */}
      <section className="patient-data-practice__section" aria-labelledby="own-data-heading">
        <h2 id="own-data-heading">{t.ownData.title}</h2>
        <p className="patient-data-practice__section-intro">{t.ownData.description}</p>
        {SECTIONS.map((s) => {
          const list = split[s.key]?.global ?? [];
          return (
            <section key={s.key} className="patient-data-practice__group">
              <h3>{t.sections[s.key]}</h3>
              {list.length === 0
                ? <p className="patient-data-practice__empty">{t.counts.none}</p>
                : renderList(s.key, list)}
            </section>
          );
        })}
      </section>

      {/* --------------------------------------------------------- B. my practices */}
      <section className="patient-data-practice__section" aria-labelledby="practices-heading">
        <h2 id="practices-heading">{t.practices.title}</h2>
        <p className="patient-data-practice__section-intro">{t.practices.description}</p>

        {activeLinks.length === 0 ? (
          <p className="patient-data-practice__empty">{t.practices.empty}</p>
        ) : (
          <>
            <PracticeSwitcher
              links={activeLinks}
              activeLinkId={activeLinkId}
              onSelect={setActiveLinkId}
              label={t.practices.tablistLabel}
            />

            {activeLink && (
              <div
                role={activeLinks.length > 1 ? "tabpanel" : undefined}
                id={`practice-panel-${activeIndex}`}
                aria-labelledby={activeLinks.length > 1 ? `practice-tab-${activeIndex}` : undefined}
                tabIndex={activeLinks.length > 1 ? 0 : undefined}
                className="patient-data-practice__panel"
              >
                <h3 className="patient-data-practice__practice-name">
                  {practiceDisplayLabel(activeLink.practice)}
                </h3>
                {SECTIONS.map((s) => {
                  const list = recordsForLink(split[s.key]?.byLink ?? new Map(), activeLink.id);
                  return (
                    <section key={s.key} className="patient-data-practice__group">
                      <h4>{t.sections[s.key]}</h4>
                      {list.length === 0
                        ? <p className="patient-data-practice__empty">{t.practices.emptySection}</p>
                        : renderList(s.key, list)}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}

        {inactiveLinks.length > 0 && (
          <section className="patient-data-practice__inactive" aria-labelledby="inactive-heading">
            <h3 id="inactive-heading">{t.practices.inactiveTitle}</h3>
            <p className="patient-data-practice__section-intro">
              {t.practices.inactiveDescription}
            </p>
            <ul className="patient-data-practice__inactive-list">
              {inactiveLinks.map((link) => (
                <li key={link.id}>
                  <span>{practiceDisplayLabel(link.practice)}</span>
                  <span className="patient-data-practice__inactive-status">
                    {link.status === "invited"
                      ? t.practices.statusInvited
                      : link.status === "archived"
                        ? t.practices.statusArchived
                        : t.practices.statusRevoked}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      {/* --------------------------------------------- B2. practices that ended */}
      <section className="patient-data-practice__section" aria-labelledby="archived-practices-heading">
        <h2 id="archived-practices-heading">{t.practices.archivedTitle}</h2>
        <p className="patient-data-practice__section-intro">
          {t.practices.archivedDescription}
        </p>
        {/* Deliberately a plain list, not a tab: a deleted practice is history,
            not a workspace. Not grouped by name either — two different
            practices can carry the same one, and the only key that would group
            them correctly is an internal id the patient must not receive. */}
        {SECTIONS.every((sec) => (split[sec.key]?.archived ?? []).length === 0) ? (
          <p className="patient-data-practice__empty">{t.practices.archivedEmpty}</p>
        ) : (
          SECTIONS.map((sec) => {
            const list = split[sec.key]?.archived ?? [];
            if (list.length === 0) return null;
            return (
              <section key={sec.key} className="patient-data-practice__group">
                <h3>{t.sections[sec.key]}</h3>
                {renderList(sec.key, list)}
              </section>
            );
          })
        )}
      </section>

      {/* ------------------------------------------------------- C. shared data */}
      <SharedDataSection t={tShare} language={language} />
    </main>
  );
}
