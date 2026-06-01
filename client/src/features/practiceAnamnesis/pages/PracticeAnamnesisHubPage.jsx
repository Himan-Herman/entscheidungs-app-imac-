import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  createAnamnesisTemplateFromStandard,
  deleteAnamnesisTemplate,
  fetchAnamnesisTemplates,
  patchAnamnesisTemplate,
} from "../api/practiceAnamnesisApi.js";
import { fetchPractices } from "../../../api/practicesApi.js";
import "../PracticeAnamnesisPages.css";

const LANGS = ["de", "en", "fr", "it", "es"];

function getLabel(json, lang) {
  if (!json || typeof json !== "object") return "—";
  return json[lang] || json.de || json.en || Object.values(json)[0] || "—";
}

function plural(t, key, count) {
  const one = t[`${key}_one`] || `${count}`;
  const other = t[`${key}_other`] || `${count}`;
  return (count === 1 ? one : other).replace("{{count}}", count);
}

export default function PracticeAnamnesisHubPage() {
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).practiceAnamnesis || getMessages("en").practiceAnamnesis, [language]);

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(searchParams.get("practiceId") || "");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [creatingStandard, setCreatingStandard] = useState(false);

  const displayLang = LANGS.includes(language) ? language : "de";

  useEffect(() => { document.title = t.pageTitle; }, [t.pageTitle]);

  useEffect(() => {
    fetchPractices().then(({ res, data }) => {
      if (res.ok && Array.isArray(data.practices)) {
        setPractices(data.practices);
        if (!practiceId && data.practices.length > 0) setPracticeId(data.practices[0].id);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchAnamnesisTemplates(practiceId);
      if (!res.ok || !data.ok) throw new Error(data?.error || "load_failed");
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.loadError]);

  useEffect(() => { void load(); }, [load]);

  async function handleFromStandard() {
    setCreatingStandard(true);
    setActionError("");
    try {
      const { res, data } = await createAnamnesisTemplateFromStandard(practiceId);
      if (!res.ok || !data.ok) throw new Error(data?.error || "create_failed");
      setTemplates((prev) => [...prev, data.template]);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setActionError(t.fromStandardError);
    } finally {
      setCreatingStandard(false);
    }
  }

  async function handleArchive(tpl) {
    if (!window.confirm(t.confirmArchiveTemplate)) return;
    setActionError("");
    const newStatus = tpl.status === "archived" ? "active" : "archived";
    try {
      const { res, data } = await patchAnamnesisTemplate(practiceId, tpl.id, { status: newStatus });
      if (!res.ok || !data.ok) throw new Error();
      setTemplates((prev) => prev.map((x) => (x.id === tpl.id ? { ...x, status: newStatus } : x)));
    } catch {
      setActionError(t.archiveError);
    }
  }

  async function handleDelete(tpl) {
    if (!window.confirm(t.confirmDeleteTemplate)) return;
    setActionError("");
    try {
      const { res, data } = await deleteAnamnesisTemplate(practiceId, tpl.id);
      if (!res.ok || !data.ok) throw new Error();
      setTemplates((prev) => prev.filter((x) => x.id !== tpl.id));
    } catch {
      setActionError(t.deleteError);
    }
  }

  function countQuestions(tpl) {
    const fromSections = (tpl.sections || []).reduce((acc, s) => acc + (s.questions?.length || 0), 0);
    const unsectioned = (tpl.questions || []).length;
    return fromSections + unsectioned;
  }

  return (
    <div className="anamnesis-hub">
      <nav className="anamnesis-hub__top-nav" aria-label="navigation">
        <Link className="anamnesis-hub__back-link" to="/practice/hub">← {t.backHub}</Link>
      </nav>

      <header className="anamnesis-hub__header">
        <h1 className="anamnesis-hub__heading">{t.heading}</h1>
        <p className="anamnesis-hub__intro">{t.intro}</p>
      </header>

      <div className="anamnesis-hub__toolbar">
        <div className="anamnesis-hub__toolbar-left">
          <label className="anamnesis-hub__select-label" htmlFor="anamnesis-practice-select">
            {t.selectPractice}
          </label>
          <select
            id="anamnesis-practice-select"
            className="anamnesis-hub__select"
            value={practiceId}
            onChange={(e) => setPracticeId(e.target.value)}
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>{p.practiceName || p.id}</option>
            ))}
          </select>
        </div>
        {practiceId && (
          <div className="anamnesis-hub__toolbar-actions">
            <Link
              className="anamnesis-hub__btn"
              to={`/practice/anamnesis/new?practiceId=${encodeURIComponent(practiceId)}`}
            >
              + {t.newTemplate}
            </Link>
            <button
              type="button"
              className="anamnesis-hub__btn anamnesis-hub__btn--outline"
              onClick={() => void handleFromStandard()}
              disabled={creatingStandard}
            >
              {creatingStandard ? t.fromStandardCreating : `⭐ ${t.fromStandard}`}
            </button>
          </div>
        )}
      </div>

      {loading && <p className="anamnesis-hub__status">{t.loading}</p>}
      {(error || actionError) && (
        <p className="anamnesis-hub__status anamnesis-hub__status--error" role="alert">
          {error || actionError}
        </p>
      )}

      {!loading && !error && practiceId && templates.length === 0 && (
        <div className="anamnesis-hub__empty">
          <p>{t.noTemplates}</p>
          <div className="anamnesis-hub__empty-actions">
            <Link
              className="anamnesis-hub__btn"
              to={`/practice/anamnesis/new?practiceId=${encodeURIComponent(practiceId)}`}
            >
              + {t.newTemplate}
            </Link>
            <button
              type="button"
              className="anamnesis-hub__btn anamnesis-hub__btn--outline"
              onClick={() => void handleFromStandard()}
              disabled={creatingStandard}
            >
              {creatingStandard ? t.fromStandardCreating : `⭐ ${t.fromStandard}`}
            </button>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <ul className="anamnesis-hub__list" role="list">
          {templates.map((tpl) => {
            const sectionCount = tpl.sections?.length || 0;
            const questionCount = countQuestions(tpl);
            const title = getLabel(tpl.titleJson, displayLang);
            const desc = tpl.descriptionJson ? getLabel(tpl.descriptionJson, displayLang) : null;
            return (
              <li key={tpl.id} className={`anamnesis-hub__card${tpl.status === "archived" ? " anamnesis-hub__card--archived" : ""}`}>
                <div className="anamnesis-hub__card-icon" aria-hidden="true">📋</div>
                <div className="anamnesis-hub__card-body">
                  <div className="anamnesis-hub__card-title">{title}</div>
                  {desc && <div className="anamnesis-hub__card-desc">{desc}</div>}
                  <div className="anamnesis-hub__card-meta">
                    <span className={`anamnesis-hub__badge${tpl.status === "archived" ? " anamnesis-hub__badge--archived" : ""}`}>
                      {tpl.status === "archived" ? t.statusArchived : t.statusActive}
                    </span>
                    {sectionCount > 0 && (
                      <span className="anamnesis-hub__card-stat">
                        {plural(t, "sectionCount", sectionCount)}
                      </span>
                    )}
                    <span className="anamnesis-hub__card-stat">
                      {plural(t, "questionCount", questionCount)}
                    </span>
                  </div>
                </div>
                <div className="anamnesis-hub__card-actions">
                  <Link
                    className="anamnesis-hub__btn anamnesis-hub__btn--sm"
                    to={`/practice/anamnesis/${tpl.id}?practiceId=${encodeURIComponent(practiceId)}`}
                  >
                    {t.openTemplate}
                  </Link>
                  <Link
                    className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--outline"
                    to={`/practice/anamnesis/${tpl.id}?practiceId=${encodeURIComponent(practiceId)}&edit=1`}
                  >
                    ✏ {t.editTemplate}
                  </Link>
                  <button
                    type="button"
                    className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--ghost"
                    onClick={() => void handleArchive(tpl)}
                  >
                    {tpl.status === "archived" ? t.unarchiveTemplate : t.archiveTemplate}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
