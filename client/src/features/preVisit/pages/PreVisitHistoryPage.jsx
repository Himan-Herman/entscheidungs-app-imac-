import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages.js";
import { hydrateSessionFromArchiveItem } from "../constants/preVisitSession.js";
import {
  clearPreVisitArchive,
  deletePreVisitArchiveItem,
  listPreVisitArchiveItems,
} from "../session/localPreVisitArchive.js";
import "../styles/PreVisitHistoryPage.css";

const copy = {
  de: {
    title: "Lokal gespeicherte Sitzungen",
    expl:
      "Diese Sitzungen sind nur in diesem Browser gespeichert. Sie wurden nicht an MedScoutX übertragen.",
    empty: "Es sind keine lokal gespeicherten Sitzungen vorhanden.",
    patientLang: "Patientensprache",
    doctorLang: "Arztsprache",
    savedAt: "Gespeichert",
    view: "Ansehen",
    delete: "Löschen",
    clearAll: "Alle gespeicherten Sitzungen löschen",
    clearConfirm:
      "Alle lokal gespeicherten Sitzungen unwiderruflich löschen?",
  },
  en: {
    title: "Locally saved sessions",
    expl:
      "These sessions are stored only in this browser. They were not transmitted to MedScoutX.",
    empty: "There are no locally saved sessions.",
    patientLang: "Patient language",
    doctorLang: "Doctor language",
    savedAt: "Saved",
    view: "View",
    delete: "Delete",
    clearAll: "Delete all saved sessions",
    clearConfirm:
      "Permanently delete all locally saved sessions? This cannot be undone.",
  },
};

function langLabel(code, uiLang) {
  const opt = PRE_VISIT_LANGUAGE_OPTIONS.find((o) => o.id === code);
  if (!opt) return code || "—";
  return uiLang === "en" ? opt.labelEn : opt.labelDe;
}

function previewFromAnswers(answers, maxLen = 140) {
  const raw =
    String(answers?.appointmentReason || "").trim() ||
    String(answers?.symptomsOwnWords || "").trim() ||
    "";
  if (!raw) return "—";
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen).trim()}…`;
}

function formatSaved(iso, uiLang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(
      uiLang === "en" ? "en-GB" : "de-DE",
      { dateStyle: "medium", timeStyle: "short" },
    ).format(d);
  } catch {
    return "—";
  }
}

export default function PreVisitHistoryPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = copy[language] ?? copy.de;

  const [items, setItems] = useState(() => listPreVisitArchiveItems());

  const refresh = useCallback(() => {
    setItems(listPreVisitArchiveItems());
  }, []);

  useEffect(() => {
    document.title =
      language === "en"
        ? "Saved sessions — Pre-Visit — MedScoutX"
        : "Gespeicherte Sitzungen — Pre-Visit — MedScoutX";
  }, [language]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [items]);

  function handleView(item) {
    if (!hydrateSessionFromArchiveItem(item)) return;
    navigate("/pre-visit/document");
  }

  function handleDelete(id) {
    deletePreVisitArchiveItem(id);
    refresh();
  }

  function handleClearAll() {
    if (!window.confirm(t.clearConfirm)) return;
    clearPreVisitArchive();
    refresh();
  }

  return (
    <div className="pre-visit-history">
      <div className="pre-visit-history__inner">
        <header className="pre-visit-history__header">
          <h1 className="pre-visit-history__title">{t.title}</h1>
          <p className="pre-visit-history__lead">{t.expl}</p>
        </header>

        {sorted.length === 0 ? (
          <p className="pre-visit-history__empty" role="status">
            {t.empty}
          </p>
        ) : (
          <ul
            className="pre-visit-history__list"
            aria-label={language === "en" ? "Saved sessions" : "Gespeicherte Sitzungen"}
          >
            {sorted.map((item) => (
              <li key={item.id} className="pre-visit-history__card-wrap">
                <article className="pre-visit-history__card">
                  <div className="pre-visit-history__card-meta">
                    <time
                      className="pre-visit-history__date"
                      dateTime={item.createdAt || undefined}
                    >
                      <span className="pre-visit-history__date-label">
                        {t.savedAt}
                      </span>{" "}
                      {formatSaved(item.createdAt, language)}
                    </time>
                    <div className="pre-visit-history__langs">
                      <span className="pre-visit-history__lang-row">
                        <span className="pre-visit-history__lang-key">
                          {t.patientLang}
                        </span>
                        <span className="pre-visit-history__lang-val">
                          {langLabel(item.patientLanguage, language)}
                        </span>
                      </span>
                      <span className="pre-visit-history__lang-row">
                        <span className="pre-visit-history__lang-key">
                          {t.doctorLang}
                        </span>
                        <span className="pre-visit-history__lang-val">
                          {langLabel(item.doctorLanguage, language)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <p className="pre-visit-history__preview">
                    {previewFromAnswers(item.answers)}
                  </p>
                  <div className="pre-visit-history__actions">
                    <button
                      type="button"
                      className="pre-visit-history__btn pre-visit-history__btn--primary"
                      onClick={() => handleView(item)}
                    >
                      {t.view}
                    </button>
                    <button
                      type="button"
                      className="pre-visit-history__btn pre-visit-history__btn--danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      {t.delete}
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {sorted.length > 0 ? (
          <div className="pre-visit-history__footer">
            <button
              type="button"
              className="pre-visit-history__btn pre-visit-history__btn--clear"
              onClick={handleClearAll}
            >
              {t.clearAll}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
